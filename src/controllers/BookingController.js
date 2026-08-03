const db = require("../config/db");
const Razorpay = require("razorpay");
const { getIO } = require("../../socket");
const Booking = require("../models/Booking");
const Ride = require("../models/Ride");
const Conversation = require("../models/Conversation");
const logger = require("../config/logger");
const User = require("../models/User");
const validatePaymentVerification =
  require("razorpay/dist/utils/razorpay-utils").validatePaymentVerification;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});

exports.store = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { ride_id, seats } = req.body;
    // Validation
    if (!ride_id) {
      return res.status(422).json({
        status: "error",
        message: "Ride is required.",
      });
    }

    if (!seats || seats <= 0) {
      return res.status(422).json({
        status: "error",
        message: "Seats are required.",
      });
    }

    await connection.beginTransaction();
    const [rides] = await connection.query(
      `SELECT *
            FROM rides
            WHERE id=?
            FOR UPDATE`,
      [ride_id],
    );

    // Check seats
    // Create booking

    await connection.commit();

    if (rides.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: "error",
        message: "Ride not found.",
      });
    }

    // Prevent self booking
    if (rides.driver_id == req.user.id) {
      await connection.rollback();
      return res.status(400).json({
        status: "error",
        message: "Driver cannot book own ride",
      });
    }

    // Seat check

    if (rides.available_seats < seats) {
      await connection.rollback();

      return res.status(400).json({
        status: "error",
        message: "Seats not available",
      });
    }

    // Duplicate booking check (optional)

    const [bookingExists] = await connection.query(
      `SELECT id
            FROM ride_bookings
            WHERE ride_id=?
            AND passenger_id=?
            AND status IN ('pending','confirmed')
            LIMIT 1`,
      [rides.id, req.user.id],
    );

    if (bookingExists.length > 0) {
      await connection.rollback();

      return res.status(400).json({
        status: "error",
        message: "You have a Booking already exists for the ride.",
      });
    }

    const bookingCode = "BK" + Date.now();
    const totalPrice = Number(ride.price_per_seat) * Number(seats);

    // Create Booking

    const [booking] = await connection.query(
      `INSERT INTO ride_bookings
            (
                booking_code,
                ride_id,
                passenger_id,
                seats,
                ride_source,
                ride_destination,
                ride_date,
                ride_time,
                price_per_seat,
                total_price,
                created_at,
                updated_at
            )
            VALUES
            (?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        bookingCode,
        ride.id,
        req.user.id,
        seats,
        ride.source_address,
        ride.destination_address,
        ride.ride_date,
        ride.departure_time,
        ride.price_per_seat,
        totalPrice,
      ],
    );

    const bookingId = booking.insertId;

    // Razorpay Order
    const order = await razorpay.orders.create({
      receipt: `booking_${bookingId}`,
      amount: totalPrice * 100,
      currency: "INR",
    });

    // Save Payment
    await connection.query(
      `INSERT INTO payments
            (
                booking_code,
                booking_id,
                order_id,
                amount,
                payment_status,
                created_at,
                updated_at
            )
            VALUES
            (?,?,?,?,'unpaid',NOW(),NOW())`,
      [bookingCode, bookingId, order.id, totalPrice],
    );

    // Deduct Seats
    await connection.query(
      `UPDATE rides
            SET available_seats = available_seats - ?,
                updated_at = NOW()
            WHERE id=?`,
      [seats, ride_id],
    );

    await connection.commit();

    const [updatedRide] = await connection.query(
      "SELECT id, available_seats FROM rides WHERE id=?",
      [ride.id],
    );

    // console.log("========== SOCKET TEST ==========");
    // console.log("Ride ID:", ride.id);
    // console.log("Room:", `ride-${ride.id}`);
    // console.log("Updated Ride:", updatedRide[0]);

    // Socket.IO Broadcast
    const io = getIO();

    io.to(`ride-${ride.id}`).emit("ride-seat-updated", updatedRide[0]);

    const [rows] = await connection.query(
      `SELECT created_at
                FROM ride_bookings
                WHERE id = ?`,
      [bookingId],
    );

    const createdAt = new Date(rows[0].created_at);
    const expiryTime = new Date(createdAt.getTime() + 5 * 60 * 1000);

    const formattedExpiryTime = expiryTime
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    // console.log(formattedExpiryTime);
    return res.json({
      status: "success",
      booking_id: bookingId,
      creationTime: createdAt,
      ExpiryTime: expiryTime,
      order_id: order.id,
      amount: totalPrice,
      razorpay_key: process.env.RAZORPAY_KEY,
    });
  } catch (err) {
    await connection.rollback();
    // console.error(err);
    logger.error(err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  } finally {
    connection.release();
  }
};

exports.paymentSuccess = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      booking_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !booking_id ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(422).json({
        status: "error",
        message: "Required fields are missing.",
      });
    }

    await connection.beginTransaction();

    // Lock Booking
    const [bookings] = await connection.query(
      `SELECT *
            FROM ride_bookings
            WHERE id=?
            FOR UPDATE`,
      [booking_id],
    );

    if (bookings.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        status: "error",
        message: "Booking not found.",
      });
    }

    const booking = bookings[0];

    // Already Paid
    if (booking.payment_status === "paid") {
      await connection.rollback();

      return res.json({
        status: "error",
        message: "Payment already processed.",
      });
    }

    // Already cancelled
    if (booking.payment_status === "failed") {
      await connection.rollback();

      return res.json({
        status: "error",
        message: "Payment already failed and booking cancelled.",
      });
    }

    const [payments] = await connection.query(
      `SELECT * FROM payments WHERE booking_id = ? FOR UPDATE`,
      [booking_id],
    );

    if (payments.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        status: "error",
        message: "Payment record not found.",
      });
    }

    const payment = payments[0];

    if (payment.order_id !== razorpay_order_id) {
      await connection.rollback();

      return res.status(400).json({
        status: "error",
        message: "Invalid Razorpay order.",
      });
    }

    // Verify Razorpay Signature
    // razorpay.utility.verifyPaymentSignature({
    //     razorpay_order_id,
    //     razorpay_payment_id,
    //     razorpay_signature
    // });

    // Verify Razorpay Signature
    try {
      validatePaymentVerification(
        {
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
        },
        razorpay_signature,
        process.env.RAZORPAY_SECRET,
      );
    } catch (e) {
      await connection.rollback();

      return res.status(400).json({
        status: "error",
        message: e.message || "Invalid payment signature.",
      });
    }

    // Lock Ride
    const [rides] = await connection.query(
      `SELECT *
            FROM rides
            WHERE id=?`,
      [booking.ride_id],
    );

    if (rides.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        status: "error",
        message: "Ride not found.",
      });
    }

    const ride = rides[0];

    // // Recheck Seat Availability
    // if (ride.available_seats < booking.seats) {

    //     await connection.rollback();

    //     return res.status(400).json({
    //         status: "error",
    //         message: "Seats unavailable."
    //     });

    // }

    // Update Booking
    await connection.query(
      `UPDATE ride_bookings
            SET
                payment_id=?,
                status='confirmed',
                payment_status='paid',
                confirmed_at=NOW(),
                updated_at=NOW()
            WHERE id=?`,
      [razorpay_payment_id, booking.id],
    );

    // Update Payment
    await connection.query(
      `UPDATE payments
            SET
                payment_id=?,
                payment_status='paid',
                updated_at=NOW()
                WHERE booking_id=?`,
      [razorpay_payment_id, booking.id],
    );

    await connection.commit();

    try {
      const conversation = await Conversation.findByBookingId(booking_id);

      if (!conversation) {
        await Conversation.create({
          booking_id,
          ride_id: ride.id,
          driver_id: ride.driver_id,
          passenger_id: booking.passenger_id,
        });
      }
    } catch (err) {
      logger.error("Conversation creation failed:", err.message);
    }

    // 4. Fetch Details
    const userData = await User.getUserWithDetails(ride.driver_id);

    return res.json({
      status: "success",
      message: "Payment successful",
      bookingDetails: await Booking.getBookingDetails(booking_id),
      rideDetails: await Ride.rideDetailsById(ride.id),
      userDetails: userData,
    });
  } catch (err) {
    await connection.rollback();
    // console.error(err);
    logger.error(err);

    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  } finally {
    connection.release();
  }
};

exports.paymentFailed = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { booking_id, reason } = req.body;

    if (!booking_id) {
      return res.status(422).json({
        status: "error",
        message: "Booking ID is required.",
      });
    }

    await connection.beginTransaction();

    // Lock Booking
    const [bookings] = await connection.query(
      `SELECT *
            FROM ride_bookings
            WHERE id = ?
            FOR UPDATE`,
      [booking_id],
    );

    if (bookings.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        status: "error",
        message: "Booking not found.",
      });
    }

    const booking = bookings[0];

    // Already Paid
    if (booking.payment_status === "paid") {
      await connection.rollback();

      return res.status(400).json({
        status: "error",
        message: "Payment already completed.",
      });
    }

    // Already Cancelled
    if (booking.status === "cancelled") {
      await connection.rollback();

      return res.status(400).json({
        status: "error",
        message: "Booking already cancelled.",
      });
    }

    // Lock Payment
    const [payments] = await connection.query(
      `SELECT *
            FROM payments
            WHERE booking_id = ?
            FOR UPDATE`,
      [booking.id],
    );

    if (payments.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        status: "error",
        message: "Payment record not found.",
      });
    }

    // Lock Ride
    const [rides] = await connection.query(
      `SELECT *
        FROM rides
        WHERE id = ?
        FOR UPDATE`,
      [booking.ride_id],
    );

    if (rides.length > 0) {
      await connection.query(
        `UPDATE rides
            SET available_seats = available_seats + ?,
                updated_at = NOW()
            WHERE id = ?`,
        [booking.seats, booking.ride_id],
      );
    }

    const ride = rides[0];

    // Update Booking
    await connection.query(
      `UPDATE ride_bookings
            SET
            status='cancelled',
            payment_status='failed',
            updated_at=NOW(),
            reason_of_cancel=?
            WHERE id=?`,
      [reason, booking.id],
    );

    // Update Payment
    await connection.query(
      `UPDATE payments
                SET
                payment_status='failed',
                updated_at=NOW()
                WHERE booking_id=?`,
      [booking.id],
    );

    await connection.commit();

    const [updatedRide] = await connection.query(
      "SELECT id, available_seats FROM rides WHERE id=?",
      [booking.ride_id],
    );

    // Socket.IO Broadcast
    const io = getIO();

    io.to(`ride-${ride.id}`).emit("ride-seat-updated", updatedRide[0]);

    const rideData = await Ride.rideDetailsById(booking.ride_id);

    // Vehicle Details
    const vehicleDetails = await Vehicle.getByVehicleId(rideData.vehicle_id);

    if (vehicleDetails) {
      rideData.vehicle_details = vehicleDetails;
    }

    // Driver Details
    const user = await User.findById(rideData.driver_id);

    if (user) {
      const userDetails = await User.getUserDetailsById(user.id);

      rideData.driver_details = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        user_details: userDetails,
      };
    }

    return res.json({
      status: "success",
      message: "Payment marked as failed.",
      ride: rideFormatData(rideData),
    });
  } catch (err) {
    await connection.rollback();
    // console.error(err);
    logger.error(err);

    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  } finally {
    connection.release();
  }
};

exports.updatePaymentsRecord = async (req, res) => {
  try {
    const [bookings] = await db.query(
      `SELECT id, total_price FROM ride_bookings ORDER BY id DESC`,
    );

    if (bookings) {
      console.log("book", bookings);
    }
  } catch (error) {}
};

// private function for format
function rideFormatData(ride) {
  return {
    id: ride.id,
    driver_id: ride.driver_id,
    vehicle_id: ride.vehicle_id,
    source_address: ride.source_address,
    source_place_id: ride.source_place_id,
    destination_address: ride.destination_address,
    destination_place_id: ride.destination_place_id,
    source_lat: ride.source_lat,
    source_lng: ride.source_lng,
    destination_lat: ride.destination_lat,
    destination_lng: ride.destination_lng,
    ride_date: ride.ride_date,
    departure_time: ride.departure_time,
    polyline: ride.polyline,
    distance_meters: ride.distance_meters,
    duration_seconds: ride.duration_seconds,
    estimated_reach_time: ride.estimated_reach_time,
    pet_allowed: ride.pet_allowed,
    smoking_allowed: ride.smoking_allowed,
    instant_booking: ride.instant_booking,
    max_two_in_back: ride.max_two_in_back,
    price_per_seat: ride.price_per_seat,
    total_seats: ride.total_seats,
    available_seats: ride.available_seats,
    status: ride.status,
    // total_price: ride.total_price,
    vehicle_details: ride.vehicle_details,
    driver_details: ride.driver_details,
    // route_points: ride.route_points
  };
}
