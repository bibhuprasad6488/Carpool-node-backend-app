const db = require("../config/db");
const SosModel = require("../models/sosModel");
const { getIO } = require("../../socket");
// const sosQueue = require("../queues/sosQueue");
const logger = require("../config/logger");

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
    console.log(`[SOS NOTIFICATION] Processing emergency alert for SOS ID: ${sosId}`);
    // await sosQueue.add("dispatch-sos-notifications", {
    //   sosId,
    //   rideId: ride_id,
    //   userId,
    //   driverId: ride.driver_id,
    //   latitude,
    //   longitude,
    // });

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
