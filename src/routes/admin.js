const express = require("express");
const router = express.Router();
const isAdmin = require("../middleware/admin");
const auth = require("../middleware/auth");
const {
  getAllRides,
  getRideDetails,
  deleteRide,
  updateRide,
  createRide,
  getDriverRides,
  getPassengerRides,
  getFullRideDetails,
} = require("../controllers/admin/RideManagement");
const adminUserController = require("../controllers/admin/UserManagement");
const {
  getAllActivityLogs,
  getActivityLogById,
  clearAllActivityLogs,
} = require("../controllers/admin/ActivityLogs");
const {
  updateVehicleStatus,
  getAllVehicles,
  getVehicleById,
  getVehiclesByUser,
} = require("../controllers/admin/VeichleController");
const adminAuthController = require("../controllers/admin/AuthController");
const {
  getAllDrivers,
  getDriverById,
  updateUserStatus,
  getPendingDrivers,
  getDriverBriefDetails,
} = require("../controllers/admin/DriverManagement");
const {
  createConversation,
  getAllConversations,
  getConversationMessages2,
  clearConversationMessages,
  deleteConversation,
  deleteSingleMessage,
} = require("../controllers/admin/ChatManagement");
const paymentController = require("../controllers/admin/paymentController");
const {
  getAllSosAlerts,
  getSosById,
  updateSosStatus,
} = require("../controllers/sosController");
const {
  getAdminRatings,
  deleteRating,
} = require("../controllers/admin/adminRatingController");
const {
  getDashboardBootstrap,
  getPlatformPerformance,
  getGrowthAnalytics,
} = require("../controllers/admin/adminDashboard");
const { getIO } = require("../../socket");
const {
  getCommission,
  updateCommission,
  getSettings,
} = require("../controllers/admin/siteSetting.controller");
const { handleExpiredRides } = require("../tasks/expireRidesTask");
const { getPayouts, getPayoutById, processPayout } = require("../controllers/admin/DriverPayout.controller");
const { getAllDevices, getAllNotifications, getDeviceById, getNotificationById, getNotificationStats } = require("../controllers/admin/adminNotification.controller");

router.get("/dashboard", auth, isAdmin, (req, res) => {
  res.json({ message: "Welcome to the admin panel backend!" });
});

router.post("/login", adminAuthController.adminLogin);

router.get("/dashboard/bootstrap", auth, isAdmin, getDashboardBootstrap);
router.get("/dashboard/analytics", auth, isAdmin, getPlatformPerformance);
router.get("/dashboard/growth", auth, isAdmin, getGrowthAnalytics);

router.get("/users", auth, isAdmin, adminUserController.getUsers);
router.get("/users/:id", auth, isAdmin, adminUserController.getUserDetails);
router.patch("/users/:id", auth, isAdmin, adminUserController.updateUserStatus);
router.patch("/users/:id/block", auth, isAdmin, adminUserController.blockUser);

router.get("/rides", auth, isAdmin, getAllRides);
router.get("/rides/:id", auth, isAdmin, getRideDetails);
router.get("/rides/details/:rideId", auth, isAdmin, getFullRideDetails);
router.post("/rides", auth, isAdmin, createRide);
router.patch("/rides/:id", auth, isAdmin, updateRide);
router.delete("/rides/:id", auth, isAdmin, deleteRide);
router.get("/rides/driver/:driverId", auth, isAdmin, getDriverRides);
router.get("/rides/passenger/:passengerId", auth, isAdmin, getPassengerRides);

router.get("/drivers", auth, isAdmin, getAllDrivers);
router.get("/drivers/pending", auth, isAdmin, getPendingDrivers);
router.get("/drivers/:id", auth, isAdmin, getDriverById);
router.get("/drivers/:id/brief", auth, isAdmin, getDriverBriefDetails);
router.patch(
  "/drivers/:userId/verify-document",
  auth,
  isAdmin,
  adminUserController.verifyDocument,
);
router.patch(
  "/drivers/:userId/status",
  auth,
  isAdmin,
  adminUserController.updateDriverStatus,
);
router.patch("/drivers/:id", auth, isAdmin, updateUserStatus);

router.get("/vehicles", auth, isAdmin, getAllVehicles);
router.get("/vehicles/:id", auth, isAdmin, getVehicleById);
router.patch("/vehicles/:id", auth, isAdmin, updateVehicleStatus);
router.get("/vehicles/user/:userId", auth, isAdmin, getVehiclesByUser);

router.get("/conversations", auth, isAdmin, getAllConversations);
router.post("/conversations", auth, isAdmin, createConversation);
router.get(
  "/conversations/:id/messages",
  auth,
  isAdmin,
  getConversationMessages2,
);
router.delete(
  "/conversations/:id/messages",
  auth,
  isAdmin,
  clearConversationMessages,
);
router.delete("/conversations/:id", auth, isAdmin, deleteConversation);
router.delete(
  "/conversations/messages/:messageId",
  auth,
  isAdmin,
  deleteSingleMessage,
);

router.get("/payments/", auth, isAdmin, paymentController.getAllPayments);
router.get("/payments/:id", auth, isAdmin, paymentController.getPaymentById);
router.get(
  "/payments/passenger/:passengerId",
  auth,
  isAdmin,
  paymentController.getPassengerTransactions,
);
router.get(
  "/refund-requests",
  auth,
  isAdmin,
  paymentController.getRefundRequests,
);
router.patch(
  "/payments/:id/",
  auth,
  isAdmin,
  paymentController.updatePaymentStatus,
);
router.post(
  "/payments/:id/refund",
  auth,
  isAdmin,
  paymentController.processRefund,
);
router.post("/webhooks/razorpay", paymentController.handleWebhook);

router.get("/sos", auth, isAdmin, getAllSosAlerts);
router.get("/sos/:id", auth, isAdmin, getSosById);
router.patch("/sos/:id/status", auth, isAdmin, updateSosStatus);

router.get("/activity-logs", auth, isAdmin, getAllActivityLogs);
router.get("/activity-logs/:id", auth, isAdmin, getActivityLogById);
router.delete("/activity-logs/clear-all", auth, isAdmin, clearAllActivityLogs);

// Ratings
router.get("/ratings", auth, isAdmin, getAdminRatings);
router.delete("/ratings/:id", auth, isAdmin, deleteRating);

router.post("/test-admin-notification", (req, res) => {
  const { type, title, message, rideId, conversationId } = req.body;

  const payload = {
    type: type || "RIDE_BOOKED",
    title: title || "Test Notification 🚗",
    message: message || "This is a test notification sent from Postman!",
    timestamp: new Date().toISOString(),
    data: {
      rideId: rideId || 101,
      conversationId: conversationId || null,
    },
  };

  // Broadcast to admin control room
  getIO().to("admin-control-room").emit("admin_notification", payload);

  return res.status(200).json({
    status: "success",
    message: "Notification emitted to admin-control-room successfully!",
    payload,
  });
});

router.get("/platform/commission", auth, isAdmin, getCommission);
router.put("/platform/commission", auth, isAdmin, updateCommission);
router.get("/platform/", auth, isAdmin, getSettings);

router.get("/payouts", auth, isAdmin, getPayouts);
router.get("/payouts/:payoutId", auth, isAdmin, getPayoutById);
router.post("/payouts/:payoutId/process", auth, isAdmin, processPayout);


// router.put(
//   '/',
//   auth,
//   isAdmin,
//   upload.fields([
//     { name: 'site_logo', maxCount: 1 },
//     { name: 'footer_logo', maxCount: 1 },
//     { name: 'footer_logo_one', maxCount: 1 },
//     { name: 'footer_logo_two', maxCount: 1 },
//     { name: 'favicon', maxCount: 1 }
//   ]),
//   updateSettings
// );

router.get("/notifications", getAllNotifications)
router.get("/notifications/devices", getAllDevices)
router.get("/notifications/device/:id", getDeviceById)
router.get("/notifications/stats", getNotificationStats)
router.get("/notifications/:id", getNotificationById)

router.get("/test-cron", async (req, res) => {
  try {
    await handleExpiredRides();
    res.json({
      success: true,
      message: "Expired rides process ran successfully!",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
