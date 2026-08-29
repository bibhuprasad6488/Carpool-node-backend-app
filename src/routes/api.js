const express = require("express");
const router = express.Router();

const uploadCloudinary = require("../middleware/uploadMiddleware");

const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const LoginController = require("../controllers/LoginController");
const UserController = require("../controllers/UserController");
const VehicleController = require("../controllers/VehicleController");
const BookingController = require("../controllers/BookingController");
const RideController = require("../controllers/RideController");
const ChatController = require("../controllers/ChatController");
const { triggerSos } = require("../controllers/sosController");
const { storeRating } = require("../controllers/ratingController");
const {
  registerDevice,
  sendTestNotification,
  broadcastNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notification.controller");
const { getEarnings } = require("../controllers/earningsController");

router.get("/get-roles", UserController.getRoles);

router.post("/register", UserController.register);

router.post("/login", uploadCloudinary.none(), LoginController.userLogin);
router.post("/forgot-password", UserController.passwordReset);
router.post("/send-otp", UserController.sendOTP);
router.post("/verify-otp", UserController.verifyOTP);

router.get("/users", auth, UserController.index);
router.get("/edit-user", auth, UserController.edit);
router.patch(
  "/update-user-details",
  auth,
  uploadCloudinary.fields([
    { name: "driver_license", maxCount: 1 },
    { name: "adhhar_card", maxCount: 1 },
    { name: "pan_card", maxCount: 1 },
    { name: "bank_account", maxCount: 1 },
    { name: "profile_picture", maxCount: 1 },
  ]),
  UserController.updateUserDetails,
);
router.post(
  "/upload-profile-image",
  auth,
  uploadCloudinary.fields([{ name: "profile_picture", maxCount: 1 }]),
  UserController.uploadProfilePicture,
);
router.get("/get-me", auth, UserController.getLoginUser);
router.get("/profile-status", auth, UserController.getProfileStatus);

/*
|--------------------------------------------------------------------------
| User
|--------------------------------------------------------------------------
*/

// router.post("/logout", AuthController.logout);

/*
|--------------------------------------------------------------------------
| Vehicle Management
|--------------------------------------------------------------------------
*/

router.get("/vehicles", auth, VehicleController.index);
router.get("/vehicles-list", auth, VehicleController.allVehicleLists);

router.post(
  "/store-vehicle-data",
  auth,
  uploadCloudinary.fields([
    { name: "rc_file", maxCount: 1 },
    { name: "insurance_file", maxCount: 1 },
    { name: "front_image", maxCount: 1 },
    { name: "back_image", maxCount: 1 },
    { name: "side_image", maxCount: 1 },
    { name: "number_plate_image", maxCount: 1 },
  ]),
  VehicleController.store,
);

router.get("/edit-vehicle-data/:id", auth, VehicleController.edit);

router.put(
  "/update-vehicle-data/:id",
  auth,
  upload("vehicle").fields([
    { name: "rc_file", maxCount: 1 },
    { name: "insurance_file", maxCount: 1 },
    { name: "front_image", maxCount: 1 },
    { name: "back_image", maxCount: 1 },
    { name: "side_image", maxCount: 1 },
    { name: "number_plate_image", maxCount: 1 },
  ]),
  VehicleController.update,
);

// router.delete("/destroy-vehicle-data/:id", auth, VehicleController.destroy);

/*
|--------------------------------------------------------------------------
| Ride Management
|--------------------------------------------------------------------------
*/
router.post("/find-rides", RideController.findRides);
router.get("/top-corridors", RideController.getTopCorridors);
router.get("/rides/recent", auth, RideController.getRecentDriverRides);
router.get("/rides/upcoming", RideController.getUpcomingRides);
router.post("/search-locaton", RideController.searchLocations);
router.get("/rides", auth, RideController.index);
router.get("/track-ride/:id",  RideController.getRideById);
router.post("/store-ride-data", auth, RideController.store);
router.get("/edit-ride-data/:id", auth, RideController.edit);
router.get("/get-ride-data/:id", RideController.getRideData);
router.patch("/ride/:rideId/start", auth, RideController.startRide);
router.patch("/ride/:rideId/complete", auth, RideController.completeRide);
router.patch("/ride/:rideId/cancel", auth, RideController.cancelRide);

/*
|--------------------------------------------------------------------------
| Booking Management
|--------------------------------------------------------------------------
*/

// router.get("/driver/booking-requests", auth, BookingController.index);
router.get("/my-bookings", auth, BookingController.getMyBookedRides);
router.get(
  "/get-booking-details/:bookingId",
  auth,
  BookingController.getBookingDetailsById,
);

router.post("/create-booking", auth, BookingController.store);
router.post("/payment-success", auth, BookingController.paymentSuccess);
router.post("/payment-failed", auth, BookingController.paymentFailed);
router.post("/passenger/cancel-booking", auth, BookingController.cancelBooking);

// router.post("/bookings/:bookingId/refund", auth, BookingController.refund);
// router.post("/bookings/:id/accept", auth, BookingController.acceptUserBooking);
// router.post("/bookings/:id/reject", auth, BookingController.rejectUserBooking);
// router.post("/bookings/:id/cancel", auth, BookingController.cancelUserBooking);

// Messages

router.get("/conversation/:bookingId", auth, ChatController.conversation);
router.get("/messages/:conversationId", auth, ChatController.messages);
router.post("/send", auth, ChatController.send);
router.get("/driver/chats", auth, ChatController.driverChats);

/// SOS
router.post("/rides/:ride_id/sos", auth, triggerSos);

// Ratings
router.post("/ratings", auth, storeRating);

//Push notifications
router.post("/notifications/devices", auth, registerDevice);
router.post("/notifications/test", auth, sendTestNotification);
router.post(
  "/admin/notifications/broadcast",
  // auth,
  //   isAdmin,
  broadcastNotification,
);

// user notification View
router.get("/notifications", auth, getNotifications);
router.patch("/notifications/read", auth, markAsRead);
router.patch("/notifications/read-all", auth, markAllAsRead);

router.get("/driver/earnings", auth, getEarnings);

module.exports = router;
