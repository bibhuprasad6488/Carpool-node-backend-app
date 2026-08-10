const db = require("../config/db");
const SosModel = require("../models/sosModel");
const { getIO } = require("../../socket");
// const sosQueue = require("../queues/sosQueue");
const logger = require("../config/logger");
const {
  sendAdminNotification,
  NOTIFICATION_TYPES,
} = require("../utils/notificationService");

exports.triggerSos = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { ride_id } = req.params;
    const { latitude, longitude } = req.body;
    const userId = req.user.id;
    // Determine user type based on route or role, default to passenger
    const userType = req.user.role === "driver" ? "driver" : "passenger";

    if (!latitude || !longitude) {
      connection.release();
      return res.status(422).json({
        status: "error",
        message: "Latitude and longitude are required.",
      });
    }

    await connection.beginTransaction();

    const [rides] = await connection.query(
      `SELECT id, driver_id, status FROM rides WHERE id = ? FOR UPDATE`,
      [ride_id],
    );

    if (rides.length === 0) {
      await connection.rollback();
      connection.release();
      return res
        .status(404)
        .json({ status: "error", message: "Ride not found." });
    }

    const ride = rides[0];

    const sosId = await SosModel.createLog(connection, {
      rideId: ride_id,
      userId,
      userType,
      latitude,
      longitude,
    });

    await connection.commit();
    connection.release();

    const io = getIO();
    const alertPayload = {
      sos_id: sosId,
      ride_id,
      user_id: userId,
      user_type: userType,
      latitude,
      longitude,
      timestamp: new Date(),
    };

    io.to("admin-control-room").emit("emergency-sos-triggered", alertPayload);
    io.to(`ride-${ride_id}`).emit("emergency-sos-triggered", alertPayload);

    // Queue background notifications (SMS / External Webhooks)
    console.log(
      `[SOS NOTIFICATION] Processing emergency alert for SOS ID: ${sosId}`,
    );
    // await sosQueue.add("dispatch-sos-notifications", {
    //   sosId,
    //   rideId: ride_id,
    //   userId,
    //   driverId: ride.driver_id,
    //   latitude,
    //   longitude,
    // });

    sendAdminNotification({
      type: NOTIFICATION_TYPES.EMERGENCY,
      title: "Emergency alert🚨🚨 ",
      message: `New SOS triggered by ${userType} with ID ${req.user.id}.`,
      data: {
        sos_id: sosId,
        ride_id: ride_id,
        user_type: userType,
        lat:latitude,
        long: longitude,
      },
    });

    return res.status(200).json({
      status: "success",
      message: "SOS alert broadcasted successfully.",
      sos_id: sosId,
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    logger.error("SOS Trigger Error:", err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

exports.getAllSosAlerts = async (req, res) => {
  try {
    const { status, page, limit } = req.query;

    const result = await SosModel.getAll({
      status,
      page: page || 1,
      limit: limit || 10,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    logger.error("Fetch SOS Alerts Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching SOS alerts.",
    });
  }
};

// Get single SOS alert details by ID
exports.getSosById = async (req, res) => {
  try {
    const { id } = req.params;
    const sosAlert = await SosModel.findById(id);

    if (!sosAlert) {
      return res.status(404).json({
        success: false,
        message: "SOS alert not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: sosAlert,
    });
  } catch (err) {
    logger.error("Fetch SOS By ID Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching SOS details.",
    });
  }
};

// Update SOS status (e.g., Acknowledged or Resolved)
exports.updateSosStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution_notes } = req.body;
    const adminId = req.user.id;

    const validStatuses = ["triggered", "acknowledged", "resolved"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(422).json({
        success: false,
        message:
          "Invalid or missing status. Allowed: triggered, acknowledged, resolved.",
      });
    }

    const sosAlert = await SosModel.findById(id);
    if (!sosAlert) {
      return res.status(404).json({
        success: false,
        message: "SOS alert not found.",
      });
    }

    await SosModel.updateStatus(id, status, adminId, resolution_notes || null);

    const io = getIO();
    const updatePayload = {
      sos_id: Number(id),
      status,
      resolved_by: adminId,
      resolution_notes,
      updated_at: new Date(),
    };

    io.to("admin-control-room").emit("sos-status-updated", updatePayload);
    io.to(`ride-${sosAlert.ride_id}`).emit("sos-status-updated", updatePayload);

    return res.status(200).json({
      success: true,
      message: `SOS alert status updated to '${status}' successfully.`,
    });
  } catch (err) {
    logger.error("Update SOS Status Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error updating SOS status.",
    });
  }
};
