const express = require('express');
const router = express.Router();
const isAdmin = require('../middleware/admin');
const auth = require('../middleware/auth');
const { getAllUsers } = require('../controllers/admin/UserManagement');
const { getAllRides } = require('../controllers/admin/RideManagement');
const { getAllActivityLogs } = require('../controllers/admin/ActivityLogs');
const { updateVehicleStatus } = require('../controllers/admin/VeichleController');

router.get('/dashboard', auth, isAdmin, (req, res) => {
    res.json({ message: "Welcome to the admin panel backend!" });
});

router.get('/users', auth, isAdmin, getAllUsers)
router.get('/rides', auth, isAdmin, getAllRides)
router.get('/activity-logs', auth, isAdmin, getAllActivityLogs)

router.patch('/vehicles/:id/status', auth, isAdmin, updateVehicleStatus)

module.exports = router; 
