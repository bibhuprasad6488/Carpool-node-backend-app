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
const { getAllActivityLogs } = require("../controllers/admin/ActivityLogs");
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
} = require("../controllers/admin/DriverManagement");
const {
    getConversations,
    getConversationMessages,
    createConversation,
} = require("../controllers/admin/ChatManagement");
const paymentController = require("../controllers/admin/paymentController");

router.get("/dashboard", auth, isAdmin, (req, res) => {
    res.json({ message: "Welcome to the admin panel backend!" });
});

router.post("/login", adminAuthController.adminLogin);

router.get("/users", auth, isAdmin, adminUserController.getUsers);
router.get("/users/:id", auth, isAdmin, adminUserController.getUserDetails);
router.patch("/users/:id", auth, isAdmin, adminUserController.updateUserStatus);

router.get("/rides", auth, isAdmin, getAllRides);
router.get("/rides/:id", auth, isAdmin, getRideDetails);
router.get('/rides/details/:rideId', auth, isAdmin, getFullRideDetails);
router.post("/rides", auth, isAdmin, createRide);
router.put("/rides/:id", auth, isAdmin, updateRide);
router.delete("/rides/:id", auth, isAdmin, deleteRide);
router.get("/rides/driver/:driverId", auth, isAdmin, getDriverRides);
router.get("/rides/passenger/:passengerId", auth, isAdmin, getPassengerRides);

router.get("/drivers", auth, isAdmin, getAllDrivers);
router.get("/drivers/:id", auth, isAdmin, getDriverById);
router.patch("/drivers/:id", auth, isAdmin, updateUserStatus);

router.get("/vehicles", auth, isAdmin, getAllVehicles);
router.get("/vehicles/:id", auth, isAdmin, getVehicleById);
router.patch("/vehicles/:id", auth, isAdmin, updateVehicleStatus);
router.get('/vehicles/user/:userId', auth, isAdmin, getVehiclesByUser);

router.get("/conversations", auth, isAdmin, getConversations);
router.post("/conversations", auth, isAdmin, createConversation);
router.get("/:id/messages", auth, isAdmin, getConversationMessages);

router.get('/payments/', auth, isAdmin, paymentController.getAllPayments);
router.get('/payments/:id', auth, isAdmin, paymentController.getPaymentById);
router.patch('/payments/:id/', auth, isAdmin, paymentController.updatePaymentStatus);
router.get('/payments/passenger/:passengerId', auth, isAdmin, paymentController.getPassengerTransactions);
router.post("/payments/:id/refund", auth, isAdmin, paymentController.processRefund);
router.post("/webhooks/razorpay", paymentController.handleWebhook);

router.get("/activity-logs", auth, isAdmin, getAllActivityLogs);

module.exports = router;
