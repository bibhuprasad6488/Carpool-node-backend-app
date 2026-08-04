// controllers/ratingController.js
const db = require("../config/db");
const RatingModel = require("../models/ratingModel");
const logger = require("../config/logger");

exports.storeRating = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { booking_id, rating, review } = req.body;
    const passengerId = req.user.id;

    // Validation
    if (!booking_id || !rating) {
      connection.release();
      return res.status(422).json({
        status: "error",
        message: "Booking ID and rating score are required.",
      });
    }

    if (rating < 1 || rating > 5) {
      connection.release();
      return res.status(422).json({
        status: "error",
        message: "Rating must be between 1 and 5 stars.",
      });
    }

    await connection.beginTransaction();

    // 1. Verify the booking belongs to this passenger
    const booking = await RatingModel.getBookingForRating(connection, booking_id, passengerId);
    console.log(booking)

    if (!booking) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        status: "error",
        message: "Booking not found or you are not authorized to rate this ride.",
      });
    }

    // Optional: Ensure booking/ride status is completed before allowing review
    if (booking.status !== "completed" && booking.status !== "confirmed") {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        status: "error",
        message: "You can only rate rides that have been completed.",
      });
    }

    // 2. Check if a rating already exists for this specific booking
    const existingRating = await RatingModel.findByBookingId(connection, booking_id);

    if (existingRating) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        status: "error",
        message: "You have already submitted a rating for this booking.",
      });
    }

    // 3. Create the rating
    const ratingId = await RatingModel.create(connection, {
      rideId: booking.ride_id,
      bookingId: booking_id,
      passengerId,
      rating,
      review,
    });

    await connection.commit();
    connection.release();

    return res.status(201).json({
      status: "success",
      message: "Rating submitted successfully.",
      rating_id: ratingId,
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    logger.error("Store Rating Error:", err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};