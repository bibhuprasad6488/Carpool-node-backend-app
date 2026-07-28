const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { validationResult } = require("express-validator");
const { getIO } = require("../socket");

exports.conversation = async (req, res) => {
    try {
        const { bookingId } = req.params;

        const conversation = await Conversation.findByBookingId(bookingId);

        if (!conversation) {
            return res.status(404).json({
                status: "error",
                message: "Conversation not found"
            });
        }

        if (
            req.user.id !== conversation.driver_id &&
            req.user.id !== conversation.passenger_id
        ) {
            return res.status(403).json({
                status: "error",
                message: "Unauthorized"
            });
        }

        return res.json({
            status: "success",
            data: conversation
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            status: "error",
            message: err.message
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
                message: "Conversation not found"
            });
        }

        if (
            req.user.id !== conversation.driver_id &&
            req.user.id !== conversation.passenger_id
        ) {
            return res.status(403).json({
                status: "error",
                message: "Unauthorized"
            });
        }

        const messages = await Message.getMessages(conversationId);

        return res.json({
            status: "success",
            data: messages
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            status: "error",
            message: err.message
        });
    }
};

exports.send = async (req, res) => {
    try {

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).json({
                status: "error",
                errors: errors.array()
            });
        }

        const { conversation_id, message } = req.body;

        const conversation = await Conversation.findById(conversation_id);

        if (!conversation) {
            return res.status(404).json({
                status: "error",
                message: "Conversation not found"
            });
        }

        if (
            req.user.id !== conversation.driver_id &&
            req.user.id !== conversation.passenger_id
        ) {
            return res.status(403).json({
                status: "error",
                message: "Unauthorized"
            });
        }

        const newMessage = await Message.create({
            conversation_id,
            sender_id: req.user.id,
            message
        });

        // Socket.IO Broadcast
        const io = getIO();

        io.to(`conversation_${conversation_id}`).emit(
            "message_received",
            newMessage
        );

        return res.json({
            status: "success",
            data: newMessage
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            status: "error",
            message: err.message
        });
    }
};