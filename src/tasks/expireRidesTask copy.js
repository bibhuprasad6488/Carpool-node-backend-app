// tasks/expireRidesTask.js
const db = require("../config/db");
const { sendUserNotification } = require("../utils/notificationService");
const {
  sendRideCancelledEmail,
} = require("../utils/emailService");

const handleExpiredRides = async () => {
  let connection;

  // Data containers for processing side-effects after DB commit
  let ridesToNotify = [];
  let bookingsToProcess = [];

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Combine ride_date and departure_time into a DATETIME for comparison
    // Matches status = 'scheduled' and departure time older than 6 hours
    const [expiredRides] = await connection.query(`
      SELECT id, driver_id, ride_date, departure_time 
      FROM rides 
      WHERE status = 'scheduled' 
        AND TIMESTAMP(ride_date, departure_time) <= NOW() - INTERVAL 6 HOUR
      FOR UPDATE
    `);

    if (expiredRides.length === 0) {
      await connection.commit();
      return;
    }

    const expiredRideIds = expiredRides.map((r) => r.id);

    // 2. Bulk update expired rides
    await connection.query(
      `UPDATE rides SET status = 'cancelled', updated_at = NOW() WHERE id IN (?)`,
      [expiredRideIds]
    );

    // 3. Fetch affected bookings
    const [bookings] = await connection.query(
      `
        SELECT
            rb.id,
            rb.ride_id,
            rb.passenger_id,
            rb.total_price,
            rb.seats,
            rb.booking_code,

            u.name AS passenger_name,
            u.email AS passenger_email

        FROM ride_bookings rb

        INNER JOIN users u
            ON u.id = rb.passenger_id

        WHERE rb.ride_id IN (?)
          AND rb.status IN ('pending', 'accepted', 'confirmed')

        FOR UPDATE
        `,
      [expiredRideIds]
    );

    if (bookings.length > 0) {
      const bookingIds = bookings.map((b) => b.id);

      // 4. Bulk update bookings to cancelled
      await connection.query(
        `UPDATE ride_bookings SET status = 'cancelled', cancel_reason = 'RIDE_EXPIRED_DRIVER_NO_SHOW', cancelled_at = NOW() WHERE id IN (?)`,
        [bookingIds]
      );
    }

    // Commit DB changes so locks are released
    await connection.commit();

    ridesToNotify = expiredRides;
    bookingsToProcess = bookings;
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("❌ [CRON ERROR] DB transaction in expireRidesTask failed:", error);
    return;
  } finally {
    if (connection) connection.release();
  }

  // =========================================================
  // SIDE-EFFECTS (Notifications) - RUN OUTSIDE LOCKS
  // =========================================================

  // 5. Notify Passengers
  for (const booking of bookingsToProcess) {
    // Push notification
    try {
      await sendUserNotification({
        userId: booking.passenger_id,
        type: "RIDE_CANCELLED",
        title: "Ride Expired & Cancelled",
        message:
          "The driver did not start the ride on time. It has been automatically cancelled.",
        data: {
          rideId: booking.ride_id,
          bookingId: booking.id,
        },
      });
    } catch (err) {
      console.error(
        `Failed to notify passenger for booking ${booking.id}:`,
        err
      );
    }

    // Email notification
    try {
      if (booking.passenger_email) {
        await sendRideCancelledEmail({
          email: booking.passenger_email,
          name: booking.passenger_name,
          bookingCode: booking.booking_code,
          rideId: booking.ride_id,
        });
      }
    } catch (err) {
      console.error(
        `Failed to send cancellation email for booking ${booking.id}:`,
        err
      );
    }
  }

  // 6. Notify Drivers
  for (const ride of ridesToNotify) {
    try {
      await sendUserNotification({
        userId: ride.driver_id,
        type: "RIDE_CANCELLED",
        title: "Ride Cancelled due to Inactivity",
        message: "You did not start your scheduled ride on time. It has been marked as cancelled.",
        data: { rideId: ride.id },
      });
    } catch (err) {
      console.error(`Failed to notify driver ${ride.driver_id} for ride ${ride.id}:`, err);
    }
  }
};

module.exports = {
  handleExpiredRides,
};