const express = require('express');
const router = express.Router();

const uploadCloudinary = require("../middleware/uploadMiddleware");

const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const LoginController = require('../controllers/LoginController');
const UserController = require('../controllers/UserController');
const VehicleController = require('../controllers/VehicleController');
const BookingController = require('../controllers/BookingController');
const RideController = require('../controllers/RideController');


router.get('/v1/get-roles', UserController.getRoles)

router.post(
    "/v1/register",
    uploadCloudinary.fields([
        { name: "driver_license", maxCount: 1 },
        { name: "adhhar_card", maxCount: 1 },
        { name: "pan_card", maxCount: 1 },
        { name: "bank_account", maxCount: 1 },
        { name: "profile_picture", maxCount: 1 }
    ]),
    UserController.register
);

router.post('/v1/login', uploadCloudinary.none(), LoginController.userLogin);
router.post("/v1/forgot-password", UserController.passwordReset);
router.post("/v1/send-otp", UserController.sendOTP);
router.post("/v1/verify-otp", UserController.verifyOTP);

router.get('/v1/users', auth, UserController.index);
router.get('/v1/edit-user/:id', auth, UserController.edit);
router.get('/v1/get-me', auth, UserController.getLoginUser);

/*
|--------------------------------------------------------------------------
| User
|--------------------------------------------------------------------------
*/

// router.post("/v1/logout", AuthController.logout);

/*
|--------------------------------------------------------------------------
| Vehicle Management
|--------------------------------------------------------------------------
*/

router.get("/v1/vehicles", auth, VehicleController.index);
router.get("/v1/vehicles-list", auth, VehicleController.allVehicleLists);

router.post("/v1/store-vehicle-data",
    auth,
    upload("vehicle").fields([
        { name: "rc_file", maxCount: 1 },
        { name: "insurance_file", maxCount: 1 },
        { name: "front_image", maxCount: 1 },
        { name: "back_image", maxCount: 1 },
        { name: "side_image", maxCount: 1 },
        { name: "number_plate_image", maxCount: 1 }
    ]), VehicleController.store);

router.get("/v1/edit-vehicle-data/:id", auth, VehicleController.edit);

router.put("/v1/update-vehicle-data/:id", auth,
    upload("vehicle").fields([
        { name: "rc_file", maxCount: 1 },
        { name: "insurance_file", maxCount: 1 },
        { name: "front_image", maxCount: 1 },
        { name: "back_image", maxCount: 1 },
        { name: "side_image", maxCount: 1 },
        { name: "number_plate_image", maxCount: 1 }
    ]), VehicleController.update);

// router.delete("/v1/destroy-vehicle-data/:id", auth, VehicleController.destroy);

/*
|--------------------------------------------------------------------------
| Ride Management
|--------------------------------------------------------------------------
*/
router.post("/v1/find-rides", RideController.findRides);
router.post('/v1/search-locaton', RideController.searchLocations);
router.get("/v1/rides", auth, RideController.index);
router.post("/v1/store-ride-data", auth, RideController.store);
router.get("/v1/edit-ride-data/:id", auth, RideController.edit);
router.get("/v1/get-ride-data/:id", RideController.getRideData);

/*
|--------------------------------------------------------------------------
| Booking Management
|--------------------------------------------------------------------------
*/

// router.get("/v1/driver/booking-requests", auth, BookingController.index);

router.post("/v1/create-booking", auth, BookingController.store);

router.post("/v1/payment-success", auth, BookingController.paymentSuccess);

router.post("/v1/payment-failed", auth, BookingController.paymentFailed);

// router.post("/bookings/:bookingId/refund", auth, BookingController.refund);

// router.post("/v1/bookings/:id/accept", auth, BookingController.acceptUserBooking);

// router.post("/v1/bookings/:id/reject", auth, BookingController.rejectUserBooking);

// router.post("/v1/bookings/:id/cancel", auth, BookingController.cancelUserBooking);


module.exports = router;