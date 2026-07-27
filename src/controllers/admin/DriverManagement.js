const DriverAdminModel = require("../../models/admin/User.admin")

exports.getAllDrivers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';

    const { total, drivers } = await DriverAdminModel.getAllDrivers({
      page,
      limit,
      search,
      status
    });

    return res.status(200).json({
      success: true,
      data: drivers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error while fetching drivers." 
    });
  }
};


exports.getDriverById = async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await DriverAdminModel.getDriverById(id);

    if (!driver) {
      return res.status(404).json({ 
        success: false, 
        message: "Driver not found or user is not a driver." 
      });
    }

    return res.status(200).json({
      success: true,
      data: driver
    });
  } catch (error) {
    console.error("Error fetching driver details:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error while fetching driver details." 
    });
  }
};