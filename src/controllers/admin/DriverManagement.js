const ActivityLog = require("../../models/admin/ActivityLog");
const DriverAdminModel = require("../../models/admin/User.admin");

const ALLOWED_STATUSES = ["active", "inactive", "pending", "blocked"];

exports.getAllDrivers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || "";

    const { total, drivers } = await DriverAdminModel.getAllDrivers({
      page,
      limit,
      search,
      status,
    });

    return res.status(200).json({
      success: true,
      data: drivers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching drivers.",
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
        message: "Driver not found or user is not a driver.",
      });
    }

    return res.status(200).json({
      success: true,
      data: driver,
    });
  } catch (error) {
    console.error("Error fetching driver details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching driver details.",
    });
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // 1. Validate payload status
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(422).json({
        status: "error",
        message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
      });
    }

    // 2. Fetch driver & check existence
    const driver = await DriverAdminModel.findById(id);

    if (!driver) {
      return res.status(404).json({
        status: "error",
        message: "Driver not found.",
      });
    }

    // 3. Ensure role matches Driver (role === 2)
    if (Number(driver.role) !== 2) {
      return res.status(400).json({
        status: "error",
        message: "User is not registered as a driver.",
      });
    }

    // 4. Perform update
    await DriverAdminModel.updateUserStatus(id, status);

    // 5. Log activity
    await ActivityLog.create({
      user_id: req.user.id,
      action: "UPDATE_DRIVER_STATUS",
      description: `Updated Driver ID ${id} status to '${status}'`,
      entity_type: "drivers",
      entity_id: id,
      ip_address: req.ip || req.headers["x-forwarded-for"],
      user_agent: req.headers["user-agent"],
      status: "success",
    });

    return res.status(200).json({
      status: "success",
      message: `Driver status successfully updated to '${status}'.`,
    });
  } catch (error) {
    // Passes DB or execution errors to your Express error middleware
    next(error); 
  }
};
