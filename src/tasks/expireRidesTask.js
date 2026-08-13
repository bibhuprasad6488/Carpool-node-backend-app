// tasks/expireRidesTask.js
const db = require("../config/db");
const {
  sendUserNotification,
  NOTIFICATION_TYPES,
} = require("../utils/notificationService");
// const paymentService = require("../services/paymentService");

const handleExpiredRides = async () => {
  const connection = await db.getConnection();

  // Data containers for processing side-effects after DB commit
  let ridesToNotify = [];
  let bookingsToProcess = [];

  try {
    await connection.beginTransaction();

    // 1. Fetch expired rides using an indexed query condition
    const [expiredRides] = await connection.query(`
      SELECT id, driver_id, departure_time 
      FROM rides 
      WHERE status = 'PUBLISHED' 
        AND departure_time <= NOW() - INTERVAL 6 HOUR
      FOR UPDATE
    `);

    if (expiredRides.length === 0) {
      await connection.commit();
      return;
    }

    const expiredRideIds = expiredRides.map((r) => r.id);

    // 2. Bulk update all expired rides
    await connection.query(
      `UPDATE rides SET status = 'EXPIRED' WHERE id IN (?)`,
      [expiredRideIds],
    );

    // 3. Fetch all affected bookings for these rides
    const [bookings] = await connection.query(
      `
      SELECT id, ride_id, passenger_id, payment_intent_id, fare_amount 
      FROM ride_bookings 
      WHERE ride_id IN (?) AND status IN ('BOOKED', 'CONFIRMED')
      FOR UPDATE
    `,
      [expiredRideIds],
    );

    if (bookings.length > 0) {
      const bookingIds = bookings.map((b) => b.id);

      // 4. Bulk update all bookings to EXPIRED_REFUNDED
      await connection.query(
        `UPDATE ride_bookings SET status = 'EXPIRED_REFUNDED' WHERE id IN (?)`,
        [bookingIds],
      );
    }

    // Commit database changes immediately so locks are released!
    await connection.commit();

    // Store data to process external services outside transaction
    ridesToNotify = expiredRides;
    bookingsToProcess = bookings;
  } catch (error) {
    await connection.rollback();
    console.error("Error during DB transaction in expireRidesTask:", error);
    return; // Exit early if DB operations failed
  } finally {
    connection.release();
  }

  // =========================================================
  // SIDE-EFFECTS (Refunds & Notifications) - RUN OUTSIDE LOCKS
  // =========================================================

  // 5. Process Refunds & Passenger Notifications
  for (const booking of bookingsToProcess) {
    try {
      // Trigger Gateway Refund (Uncomment when payment service is ready)
      /*
      if (booking.payment_intent_id) {
        await paymentService.processRefund({
          paymentIntentId: booking.payment_intent_id,
          amount: booking.fare_amount,
          reason: "RIDE_EXPIRED_DRIVER_NO_SHOW",
        });
      }
      */

      // Notify Passenger safely
      await sendUserNotification({
        userId: booking.passenger_id,
        type: NOTIFICATION_TYPES.RIDE_CANCELLED,
        title: "Ride Expired & Refund Issued",
        message:
          "The driver did not start the ride. A full refund has been initiated.",
        data: { rideId: booking.ride_id, bookingId: booking.id },
      });
    } catch (err) {
      console.error(
        `Failed to process refund/notification for booking ${booking.id}:`,
        err,
      );
    }
  }

  // 6. Notify Drivers
  for (const ride of ridesToNotify) {
    try {
      await sendUserNotification({
        userId: ride.driver_id,
        type: NOTIFICATION_TYPES.RIDE_CANCELLED,
        title: "Ride Cancelled due to Inactivity",
        message:
          "You did not start your scheduled ride. It has been marked as expired.",
        data: { rideId: ride.id },
      });
    } catch (err) {
      console.error(
        `Failed to notify driver ${ride.driver_id} for ride ${ride.id}:`,
        err,
      );
    }
  }
};

module.exports = {
  handleExpiredRides,
};
