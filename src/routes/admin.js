const express = require('express');
const router = express.Router();
const isAdmin = require('../middleware/admin');
const auth = require('../middleware/auth');
const { getAllUsers } = require('../controllers/admin/UserManagement');
const { getAllRides } = require('../controllers/admin/RideManagement');

router.get('/dashboard', auth, isAdmin, (req, res) => {
    res.json({ message: "Welcome to the admin panel backend!" });
});

router.get('/users', auth, isAdmin, getAllUsers)
router.get('/rides', auth, isAdmin, getAllRides)

module.exports = router; 
