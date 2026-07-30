const Vehicle = require("../../models/Vehicle");
const ActivityLog = require("../../models/admin/ActivityLog");
const VehicleAdminModel = require("../../models/admin/Vehichle.admin");

const ALLOWED_STATUSES = ["active", "inactive", "pending", "blocked"];

exports.getAllVehicles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    const { total, vehicles } = await VehicleAdminModel.getAllVehicles({ page, limit, search });

    return res.status(200).json({
      success: true,
      data: vehicles,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;
    const vehicle = await VehicleAdminModel.getVehicleById(id);

    if (!vehicle) {
      return res.status(404).json({ success: false, message: "Vehicle not found." });
    }

    return res.status(200).json({ success: true, data: vehicle });
  } catch (error) {
    console.error("Error fetching vehicle details:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.updateVehicleStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(422).json({
      status: "error",
      message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
    });
  }

  const vehicle = await VehicleAdminModel.getVehicleById(id);

  if (!vehicle) {
    return res.status(404).json({
      status: "error",
      message: "Vehicle not found.",
    });
  }

  await VehicleAdminModel.updateStatus(id, status);

  await ActivityLog.create({
    user_id: req.user.id,
    action: "UPDATE_VEHICLE_STATUS",
    description: `Updated vehicle ID ${id} status to '${status}'`,
    entity_type: "vehicles",
    entity_id: id,
    ip_address: req.ip || req.headers["x-forwarded-for"],
    user_agent: req.headers["user-agent"],
    status: "success",
  });

  return res.status(200).json({
    status: "success",
    message: `Vehicle status successfully updated to '${status}'.`,
  });
};

exports.getVehiclesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const vehicles = await VehicleAdminModel.getVehiclesByUserId(userId);

    return res.status(200).json({
      success: true,
      message: 'User vehicles fetched successfully',
      data: vehicles,
    });
  } catch (error) {
    console.error('Error in getVehiclesByUser:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching user vehicles',
      error: error.message,
    });
  }
};