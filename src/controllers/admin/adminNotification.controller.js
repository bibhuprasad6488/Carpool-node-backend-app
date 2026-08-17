const notificationRepository = require("../../models/pushnotification.model");

const getAllDevices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      platform,
      is_active,
    } = req.query;

    const result = await notificationRepository.getAllDevices({
      page: Number(page),
      limit: Number(limit),
      search,
      platform,
      isActive: is_active !== undefined ? Number(is_active) : undefined,
    });

    return res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error("[ADMIN NOTIFICATIONS] Get devices failed:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch notification devices.",
    });
  }
};

const getDeviceById = async (req, res) => {
  try {
    const { id } = req.params;

    const device = await notificationRepository.getDeviceById(id);

    if (!device) {
      return res.status(404).json({
        status: "error",
        message: "Notification device not found.",
      });
    }

    return res.status(200).json({
      status: "success",
      data: device,
    });
  } catch (error) {
    console.error("[ADMIN NOTIFICATIONS] Get device failed:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch notification device.",
    });
  }
};

const getAllNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, user_id, status } = req.query;

    const result = await notificationRepository.getAllNotifications({
      page: Number(page),
      limit: Number(limit),
      type,
      userId: user_id,
      status,
    });

    return res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error("[ADMIN NOTIFICATIONS] Get notifications failed:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch notifications.",
    });
  }
};

const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await notificationRepository.getNotificationById(id);

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      status: "success",
      data: notification,
    });
  } catch (error) {
    console.error("[ADMIN NOTIFICATIONS] Get notification failed:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch notification.",
    });
  }
};

const getNotificationStats = async (req, res) => {
  try {
    const stats = await notificationRepository.getNotificationStats();

    return res.status(200).json({
      status: "success",
      data: stats,
    });
  } catch (error) {
    console.error("[ADMIN NOTIFICATIONS] Stats failed:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch notification statistics.",
    });
  }
};

module.exports = {
  getAllDevices,
  getDeviceById,
  getAllNotifications,
  getNotificationById,
  getNotificationStats,
};
