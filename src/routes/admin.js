const express = require('express');
const router = express.Router();
const isAdmin = require('../middleware/admin');
const auth = require('../middleware/auth');
const { getAllRides, getRideDetails, deleteRide, updateRide, createRide } = require('../controllers/admin/RideManagement');
const adminUserController = require("../controllers/admin/UserManagement");
const { getAllActivityLogs } = require('../controllers/admin/ActivityLogs');
const { updateVehicleStatus, getAllVehicles, getVehicleById } = require('../controllers/admin/VeichleController');
const adminAuthController = require("../controllers/admin/AuthController");
const { getAllDrivers, getDriverById } = require('../controllers/admin/DriverManagement');
const { getConversations, getConversationMessages, createConversation } = require('../controllers/admin/ChatManagement');

router.get('/dashboard', auth, isAdmin, (req, res) => {
    res.json({ message: "Welcome to the admin panel backend!" });
});


router.post("/login", adminAuthController.adminLogin);

router.get('/users', auth, isAdmin, adminUserController.getUsers );
router.get("/users/:id", auth, isAdmin, adminUserController.getUserDetails);
router.patch('/users/:id', auth, isAdmin, adminUserController.updateUserStatus);

router.get('/rides', auth, isAdmin, getAllRides)
router.get("/rides/:id", auth, isAdmin, getRideDetails);
router.post('/rides', auth, isAdmin, createRide);
router.put('/rides/:id', auth, isAdmin, updateRide);
router.delete('/rides/:id', auth, isAdmin, deleteRide);

router.get('/drivers', auth, isAdmin, getAllDrivers);
router.get('/drivers/:id', auth, isAdmin, getDriverById);

router.get('/vehicles', auth, isAdmin, getAllVehicles);
router.get('/vehicles/:id', auth, isAdmin, getVehicleById);
router.patch('/vehicles/:id', auth, isAdmin, updateVehicleStatus);

router.get('/conversations', getConversations)
router.post('/conversations', createConversation)
router.get('/:id/messages', getConversationMessages);

router.get('/activity-logs', auth, isAdmin, getAllActivityLogs)

module.exports = router; 
