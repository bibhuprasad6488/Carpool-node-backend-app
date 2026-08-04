const logger = require("../../config/logger");
const RatingModel = require("../../models/ratingModel");


exports.getAdminRatings = async (req, res) => {
  try {
    const { page, limit, rating } = req.query;

    const result = await RatingModel.getAllForAdmin({
      page: page || 1,
      limit: limit || 10,
      ratingFilter: rating || null,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    logger.error("Admin Fetch Ratings Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching ratings.",
    });
  }
};

// Delete/Moderate an abusive or inappropriate rating
exports.deleteRating = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await RatingModel.deleteById(id);
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Rating not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Rating removed by admin successfully.",
    });
  } catch (err) {
    logger.error("Admin Delete Rating Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error deleting rating.",
    });
  }
};