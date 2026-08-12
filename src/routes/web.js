const express = require('express');

const router = express.Router();

const HomeController = require('../controllers/HomeController');
// const UserController = require('../controllers/UserController');
// const LoginController = require('../controllers/LoginController');

router.get('/', HomeController.index);

module.exports = router;