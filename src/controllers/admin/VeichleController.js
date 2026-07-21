const Vehicle = require("../../models/Vehicle");
const ActivityLog = require("../../models/admin/ActivityLog");

const ALLOWED_STATUSES = ["active", "inactive", "pending", "blocked"];

exports.updateVehicleStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(422).json({
      status: "error",
      message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
    });
  }

  const vehicle = await Vehicle.getByVehicleId(id);

  if (!vehicle) {
    return res.status(404).json({
      status: "error",
      message: "Vehicle not found.",
    });
  }

  await Vehicle.updateStatus(id, status);

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

