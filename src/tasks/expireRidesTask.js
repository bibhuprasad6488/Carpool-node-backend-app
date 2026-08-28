// tasks/expireRidesTask.js
const db = require("../config/db");
const NOTIFICATION_TYPES = require("../constants/notificationTypes");
const { sendNotificationToUser } = require("../services/pushNotification.service");

const handleExpiredRides = async () => {
  let connection;

  let ridesToNotify = [];
  let bookingsToProcess = [];

  // Variables to track affected row counts
  let updatedRidesCount = 0;
  let updatedBookingsCount = 0;
  let updatedPaymentsCount = 0;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Fetch rides scheduled but not started within 6 hours of departure
    const [expiredRides] = await connection.query(`
      SELECT id, driver_id, ride_date, departure_time 
      FROM rides 
      WHERE status = 'scheduled' 
        AND TIMESTAMP(ride_date, departure_time) <= NOW() - INTERVAL 6 HOUR
      FOR UPDATE
    `);

    if (expiredRides.length === 0) {
      console.log("⏰ [CRON] No expired rides found.");
      await connection.commit();
      return;
    }

    const expiredRideIds = expiredRides.map((r) => r.id);

    // 2. Mark rides as 'expired'
    const [rideResult] = await connection.query(
      `UPDATE rides SET status = 'expired', updated_at = NOW() WHERE id IN (?)`,
      [expiredRideIds],
    );
    updatedRidesCount = rideResult.affectedRows;

    // 3. Fetch all active bookings for these expired rides
    const [bookings] = await connection.query(
      `
      SELECT id, booking_code, ride_id, passenger_id, total_price, payment_status, payment_id
      FROM ride_bookings 
      WHERE ride_id IN (?) AND status IN ('pending', 'accepted', 'confirmed')
      FOR UPDATE
    `,
      [expiredRideIds],
    );

    if (bookings.length > 0) {
      const bookingIds = bookings.map((b) => b.id);
      const bookingCodes = bookings.map((b) => b.booking_code);

      // 4. Update bookings to 'cancelled' and payment_status to 'refunded' if paid
      const [bookingResult] = await connection.query(
        `UPDATE ride_bookings 
         SET status = 'cancelled', 
             cancel_reason = 'RIDE_EXPIRED_DRIVER_NO_SHOW',
             reason_of_cancel = 'Driver did not start the ride on time',
             cancelled_at = NOW(),
             payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END,
             updated_at = NOW()
         WHERE id IN (?)`,
        [bookingIds],
      );
      updatedBookingsCount = bookingResult.affectedRows;

      // 5. Update corresponding payments records to 'refund_requested'
      const [paymentResult] = await connection.query(
        `UPDATE payments 
         SET payment_status = 'refund_requested', 
             refunded_at = NOW(),
             updated_at = NOW()
         WHERE booking_code IN (?) OR booking_id IN (?)`,
        [bookingCodes, bookingIds],
      );
      updatedPaymentsCount = paymentResult.affectedRows;
    }

    await connection.commit();

    // Summary Log inside transaction success block
    console.log("==========================================");
    console.log("✅ [CRON SUCCESS] Expired Rides Task Completed");
    console.log(`📌 Rides marked expired:      ${updatedRidesCount}`);
    console.log(`📌 Bookings marked cancelled: ${updatedBookingsCount}`);
    console.log(`📌 Payments marked refund requested:  ${updatedPaymentsCount}`);
    console.log("==========================================");

    ridesToNotify = expiredRides;
    bookingsToProcess = bookings;
  } catch (error) {
    if (connection) await connection.rollback();
    console.error(
      "❌ [CRON ERROR] DB transaction in expireRidesTask failed:",
      error,
    );
    return;
  } finally {
    if (connection) connection.release();
  }

  // =========================================================
  // SIDE-EFFECTS (Notifications & Payment Refunds)
  // =========================================================

  // 6. Notify Passengers
  for (const booking of bookingsToProcess) {
    try {
      await sendNotificationToUser({
        userId: booking.passenger_id,
        type: NOTIFICATION_TYPES.RIDE_CANCELLED || "RIDE_CANCELLED",
        title: "Ride Expired & Cancelled",
        body:
          "The driver did not start the ride on time. Your booking has been cancelled and any payment will be refunded.",
        data: {
          rideId: booking.ride_id,
          bookingId: booking.id,
          bookingCode: booking.booking_code,
        },
      });
    } catch (err) {
      console.error(
        `Failed to notify passenger for booking ${booking.id}:`,
        err,
      );
    }
  }

  // 7. Notify Drivers
  for (const ride of ridesToNotify) {
    try {
      await sendNotificationToUser({
        userId: ride.driver_id,
        type: NOTIFICATION_TYPES.RIDE_CANCELLED || "RIDE_CANCELLED",
        title: "Ride Expired due to Inactivity",
        body:
          "You did not start your scheduled ride within the 6-hour window. It has been marked as expired.",
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
