const db = require("../config/db");
const Razorpay = require("razorpay");
const { getIO } = require("../sockets");
const Booking = require("../models/Booking");
const Ride = require("../models/Ride");
const validatePaymentVerification = require("razorpay/dist/utils/razorpay-utils").validatePaymentVerification;


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET
});



exports.store = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { ride_id, seats } = req.body;
        // Validation
        if (!ride_id) {
            return res.status(422).json({
                status: "error",
                message: "Ride is required."
            });
        }

        if (!seats || seats <= 0) {
            return res.status(422).json({
                status: "error",
                message: "Seats are required."
            });
        }

        await connection.beginTransaction();

        const [rides] = await connection.query(
            `SELECT *
            FROM rides
            WHERE id=?
            FOR UPDATE`,
            [ride_id]
        );

        const ride = rides[0];

        // Check seats
        // Create booking

        await connection.commit();

        if (rides.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                status: "error",
                message: "Ride not found."
            });

        }


        // Prevent self booking

        if (ride.driver_id == req.user.id) {

            await connection.rollback();

            return res.status(400).json({
                status: "error",
                message: "Driver cannot book own ride"
            });

        }

        // Seat check

        if (ride.available_seats < seats) {

            await connection.rollback();

            return res.status(400).json({
                status: "error",
                message: "Seats not available"
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
            [ride.id, req.user.id]
        );

        if (bookingExists.length > 0) {

            await connection.rollback();

            return res.status(400).json({
                status: "error",
                message: "You have a Booking already exists for the ride."
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
                totalPrice
            ]
        );

        const bookingId = booking.insertId;

        // Razorpay Order
        const order = await razorpay.orders.create({
            receipt: `booking_${bookingId}`,
            amount: totalPrice * 100,
            currency: "INR"
        });

        // Save Payment

        await connection.query(
            `INSERT INTO payments
            (
                booking_code,
                booking_id,
                order_id,
                payment_status,
                created_at,
                updated_at
            )
            VALUES
            (?,?,?,'unpaid',NOW(),NOW())`,
            [
                bookingCode,
                bookingId,
                order.id
            ]
        );

        await connection.commit();

        return res.json({
            status: "success",
            booking_id: bookingId,
            order_id: order.id,
            amount: totalPrice,
            razorpay_key: process.env.RAZORPAY_KEY
        });
    } catch (err) {
        await connection.rollback();
        return res.status(500).json({
            status: "error",
            message: err.message
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
            razorpay_signature
        } = req.body;

        if (
            !booking_id ||
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {
            return res.status(422).json({
                status: "error",
                message: "Required fields are missing."
            });
        }

        await connection.beginTransaction();

        // Lock Booking
        const [bookings] = await connection.query(
            `SELECT *
            FROM ride_bookings
            WHERE id=?
            FOR UPDATE`,
            [booking_id]
        );

        if (bookings.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                status: "error",
                message: "Booking not found."
            });

        }

        const booking = bookings[0];

        // Already Paid
        if (booking.payment_status === "paid") {

            await connection.rollback();

            return res.json({
                status: "error",
                message: "Payment already processed."
            });

        }

        const [payments] = await connection.query(
            `SELECT * FROM payments WHERE booking_id = ? FOR UPDATE`,
            [booking_id]
        );

        if (payments.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                status: "error",
                message: "Payment record not found."
            });
        }

        const payment = payments[0];

        if (payment.order_id !== razorpay_order_id) {
            await connection.rollback();

            return res.status(400).json({
                status: "error",
                message: "Invalid Razorpay order."
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
                    payment_id: razorpay_payment_id
                },
                razorpay_signature,
                process.env.RAZORPAY_SECRET
            );
        } catch (e) {
            await connection.rollback();

            return res.status(400).json({
                status: "error",
                message: e.message || "Invalid payment signature."
            });
        }
        // Lock Ride
        const [rides] = await connection.query(
            `SELECT *
            FROM rides
            WHERE id=?
            FOR UPDATE`,
            [booking.ride_id]
        );

        if (rides.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                status: "error",
                message: "Ride not found."
            });

        }

        const ride = rides[0];

        // Recheck Seat Availability
        if (ride.available_seats < booking.seats) {

            await connection.rollback();

            return res.status(400).json({
                status: "error",
                message: "Seats unavailable."
            });

        }

        // Deduct Seats
        await connection.query(
            `UPDATE rides
            SET available_seats = available_seats - ?,
                updated_at = NOW()
            WHERE id=?`,
            [
                booking.seats,
                ride.id
            ]
        );

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
            [razorpay_payment_id, booking.id]
        );

        // Update Payment
        await connection.query(
            `UPDATE payments
            SET
                payment_id=?,
                payment_status='paid',
                updated_at=NOW()
                WHERE booking_id=?`,
            [
                razorpay_payment_id,
                booking.id
            ]
        );

        await connection.commit();

        const [updatedRide] = await connection.query(
            "SELECT id, available_seats FROM rides WHERE id=?",
            [ride.id]
        );

        // getIO.to(`ride-${ride.id}`).emit("ride-seat-updated", updatedRide[0]);


        // 4. Fetch Details
        const [userRows] = await connection.query(
            `SELECT u.id, u.name, u.email, u.phone, u.role,
                ud.city, ud.state, ud.country, ud.postal_code, ud.address,
                ud.bank_account_holder, ud.bank_account_number, ud.bank_account_ifsc, ud.bank_name,
                ud.driver_license, ud.adhhar_card, ud.pan_card, ud.bank_account, ud.profile_picture
        FROM users u
        LEFT JOIN user_details ud ON ud.user_id = u.id
        WHERE u.id = ?`,
            [ride.driver_id],
        );

        return res.json({
            status: "success",
            message: "Payment successful",
            bookingDetails: await Booking.getBookingDetails(booking_id),
            rideDetails: await Ride.rideDetailsById(ride.id),
            userDetails: userRows[0]
        });

    } catch (err) {

        await connection.rollback();

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    } finally {

        connection.release();

    }

};

exports.paymentFailed = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const { booking_id } = req.body;

        if (!booking_id) {
            return res.status(422).json({
                status: "error",
                message: "Booking ID is required."
            });
        }

        await connection.beginTransaction();

        // Lock booking
        const [bookings] = await connection.query(
            `SELECT *
             FROM ride_bookings
             WHERE id=?
             FOR UPDATE`,
            [booking_id]
        );

        if (bookings.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                status: "error",
                message: "Booking not found."
            });

        }

        const booking = bookings[0];

        // Prevent changing already paid booking
        if (booking.payment_status === "paid") {

            await connection.rollback();

            return res.status(400).json({
                status: "error",
                message: "Payment already completed."
            });

        }

        // Update Booking
        await connection.query(
            `UPDATE ride_bookings
             SET
                status='cancelled',
                payment_status='failed',
                updated_at=NOW()
             WHERE id=?`,
            [booking.id]
        );

        // Update Payment
        await connection.query(
            `UPDATE payments
             SET
                payment_status='failed',
                updated_at=NOW()
             WHERE booking_id=?`,
            [booking.id]
        );

        await connection.commit();

        return res.json({
            status: "success",
            message: "Payment marked as failed."
        });

    } catch (err) {

        await connection.rollback();

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    } finally {

        connection.release();

    }

};

