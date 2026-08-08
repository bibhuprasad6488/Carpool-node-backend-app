const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { validationResult } = require("express-validator");
const { getIO } = require("../../socket");
const db = require("../config/db");
const Ride = require("../models/Ride");
const Vehicle = require("../models/Vehicle");
const User = require("../models/User");
const logger = require("../config/logger");
const { NOTIFICATION_TYPES } = require("../utils/notificationService");

exports.conversation = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const conversation = await Conversation.findByBookingId(bookingId);
    if (!conversation) {
      return res.status(404).json({
        status: "error",
        message: "Conversation not found",
      });
    }

    if (
      req.user.id !== conversation.driver_id &&
      req.user.id !== conversation.passenger_id
    ) {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    if (req.user.id == conversation.driver_id) {
      const userData = await User.getUserWithDetails(conversation.passenger_id);
      conversation.userDetails = userData;
      const ride = await Ride.rideDetailsById(conversation.ride_id);
      // Ride Details
      if (ride) {
        // Vehicle Details
        const vehicleDetails = await Vehicle.getByVehicleId(ride.vehicle_id);

        if (vehicleDetails) {
          ride.vehicle_details = vehicleDetails;
        }

        conversation.rideDetails = ride;
      } else {
        conversation.rideDetails = null;
      }
    } else if (req.user.id == conversation.passenger_id) {
      const driverData = await User.getUserWithDetails(conversation.driver_id);
      conversation.userDetails = driverData;
    }

    return res.json({
      status: "success",
      data: conversation,
    });
  } catch (err) {
    // console.error(err);
    logger.error(err);

    return res.status(500).json({
      status: "error",
      message: err,
    });
  }
};

exports.messages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        status: "error",
        message: "Conversation not found",
      });
    }

    if (
      req.user.id !== conversation.driver_id &&
      req.user.id !== conversation.passenger_id
    ) {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    const messages = await Message.getMessages(conversationId);

    const response = messages.map(function (m) {
      const createdAt = new Date(m.created_at);

      m.date = createdAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }); // 01 Aug 2026

      m.time = createdAt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }); // 2:35 PM

      m.sender = m.sender == 2 ? "driver" : "passenger";
      delete m.created_at;
      return m;
    });

    return res.json({
      status: "success",
      data: response,
    });
  } catch (err) {
    // console.error(err);
    logger.error(err);

    return res.status(500).json({
      status: "error",
      message: err,
    });
  }
};

exports.send = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ status: "error", errors: errors.array() });
    }

    const { conversation_id, message } = req.body;
    const conversation = await Conversation.findById(conversation_id);

    if (!conversation) {
      return res
        .status(404)
        .json({ status: "error", message: "Conversation not found" });
    }

    if (
      req.user.id !== conversation.driver_id &&
      req.user.id !== conversation.passenger_id
    ) {
      return res.status(403).json({ status: "error", message: "Unauthorized" });
    }

    const newMessage = await Message.create({
      conversation_id,
      sender_id: req.user.id,
      message,
    });

    newMessage.sender = newMessage.sender == 2 ? "driver" : "passenger";
    const createdAt = new Date(newMessage.created_at);

    newMessage.date = createdAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }); // 01 Aug 2026

    newMessage.time = createdAt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }); // 2:35 PM

    // Remove the original datetime field
    delete newMessage.created_at;

    // Broadcast to authorized room only
    const io = getIO();
    io.to(`conversation_${conversation_id}`).emit(
      "message_received",
      newMessage,
    );

    sendAdminNotification({
      type: NOTIFICATION_TYPES.CONVERSATION,
      title: "New Message Recieved..!!",
      message: `New message from ${req.user.id}.`,
      data: {
        conversation_id: conversation_id,
        message:newMessage,
      },
    });

    return res.json({
      status: "success",
      data: newMessage,
    });
  } catch (err) {
    // console.error(err);
    logger.error(err);
    return res.status(500).json({ status: "error", message: err });
  }
};

exports.driverChats = async (req, res) => {
  const driverId = req.user.id;
  try {
    const conversations = await Conversation.findByDriverId(driverId);
    // console.log(conversations);
    return res.status(200).json({ status: "success", data: conversations });
  } catch (err) {
    logger.error(err);

    return res.status(500).json({
      status: "error",
      message: err,
    });
  }
};
