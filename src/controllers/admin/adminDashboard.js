const adminDashboard = require("../../models/admin/adminDashboard");

exports.getDashboardBootstrap = async (req, res, next) => {
  try {
    const dashboardData = await adminDashboard.getBootstrapData();

    return res.status(200).json({
      success: true,
      message: "Dashboard initialized successfully",
      data: dashboardData,
    });
  } catch (error) {
    next(error);
  }
};

exports.getPlatformPerformance = async (req, res) => {
  try {
    const { timeframe, comparison } = req.query;

    const analyticsData = await adminDashboard.getAnalyticsData({
      timeframe,
      comparison,
    });

    return res.status(200).json({
      success: true,
      message: "Analytics platform performance data retrieved successfully",
      data: analyticsData,
    });
  } catch (error) {
    console.error("Error in getPlatformPerformance controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve analytics data",
      error: error.message,
    });
  }
};
