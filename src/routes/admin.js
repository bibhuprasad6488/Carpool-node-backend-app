const express = require('express');
const router = express.Router();
const isAdmin = require('../middleware/admin');
const auth = require('../middleware/auth');
const { getAllRides, getRideDetails, deleteRide, updateRide, createRide } = require('../controllers/admin/RideManagement');
const adminUserController = require("../controllers/admin/UserManagement");
const { getAllActivityLogs } = require('../controllers/admin/ActivityLogs');
const { updateVehicleStatus } = require('../controllers/admin/VeichleController');
const adminAuthController = require("../controllers/admin/AuthController");

router.get('/dashboard', auth, isAdmin, (req, res) => {
    res.json({ message: "Welcome to the admin panel backend!" });
});


router.post("/login", adminAuthController.adminLogin);

router.get('/users', auth, isAdmin, adminUserController.getUsers )
router.get("/users/:id", auth, isAdmin, adminUserController.getUserDetails);

router.get('/rides', auth, isAdmin, getAllRides)
router.get("/rides/:id", auth, isAdmin, getRideDetails);
router.post('/rides', auth, isAdmin, createRide);
router.put('/rides/:id', auth, isAdmin, updateRide);
router.delete('/rides/:id', auth, isAdmin, deleteRide );

router.get('/activity-logs', auth, isAdmin, getAllActivityLogs)

router.patch('/vehicles/:id/status', auth, isAdmin, updateVehicleStatus)

module.exports = router; 
