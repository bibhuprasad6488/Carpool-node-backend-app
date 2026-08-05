const { validationResult } = require("express-validator");
const ConversationManagement = require("../../models/admin/Conversation");
const logger = require("../../config/logger");



exports.getConversationMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await ConversationManagement.findById(id);

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }

    // const messages = await Message.getMessages(id);
    return res.status(200).json({
      success: true,
      data: {
        conversation,
        // messages
      }
    });
  } catch (error) {
    console.error("Error fetching admin conversation messages:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.createConversation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ status: 'error', errors: errors.array() });
    }

    const { booking_id, ride_id, driver_id, passenger_id } = req.body;

    const newConversation = await ConversationManagement.create({
      booking_id,
      ride_id,
      driver_id: Number(driver_id),
      passenger_id: Number(passenger_id)
    });

    return res.status(201).json({
      status: 'success',
      message: 'Conversation created successfully',
      data: newConversation
    });

  } catch (err) {
    console.error('Error creating conversation:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error while creating conversation'
    });
  }
};

exports.getAllConversations = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const result = await ConversationManagement.getAllConversations({ page, limit, search });

    return res.status(200).json({
      success: true,
      data: result.conversations,
      pagination: {
        totalRecords: result.totalRecords,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: Number(limit),
      },
    });
  } catch (err) {
    logger.error("Get All Conversations Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching conversations.",
    });
  }
};

exports.getConversationMessages2 = async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await ConversationManagement.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    const messages = await ConversationManagement.getMessagesByConversationId(id);

    return res.status(200).json({
      success: true,
      data: {
        conversation,
        messages,
      },
    });
  } catch (err) {
    logger.error("Get Conversation Messages Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching messages.",
    });
  }
};