const adminDashboard = require('../../models/admin/adminDashboard');

exports.getDashboardBootstrap = async (req, res, next) => {
  try {
    const dashboardData = await adminDashboard.getBootstrapData();
    
    return res.status(200).json({
      success: true,
      message: 'Dashboard initialized successfully',
      data: dashboardData,
    });
  } catch (error) {
    next(error);
  }
};