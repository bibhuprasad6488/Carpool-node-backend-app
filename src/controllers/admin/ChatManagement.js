const { validationResult } = require("express-validator");
const ConversationManagement = require("../../models/admin/Conversation");
const logger = require("../../config/logger");



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

exports.clearConversationMessages = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Check if conversation exists
    const conversation = await ConversationManagement.findById(id);
    if (!conversation) {
      return res.status(404).json({
        status: "error",
        message: "Conversation not found.",
      });
    }

    // 2. Perform deletion
    const result = await ConversationManagement.deleteAllMessages(id);

    return res.status(200).json({
      status: "success",
      message: `Successfully cleared all messages for conversation ID ${id}.`,
      deletedCount: result.affectedRows,
    });
  } catch (error) {
    console.error("Error clearing conversation messages:", error);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while attempting to delete messages.",
      error: error.message,
    });
  }
}

exports.deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Check if the conversation exists
    const conversation = await ConversationManagement.findById(id);
    if (!conversation) {
      return res.status(404).json({
        status: "error",
        message: "Conversation not found.",
      });
    }

    // 2. Execute deletion model method
    const result = await ConversationManagement.deleteConversation(id);

    // 3. Return response
    return res.status(200).json({
      status: "success",
      message: `Conversation ${id} and all related messages were deleted successfully.`,
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while deleting the conversation.",
      error: error.message,
    });
  }
};

exports.deleteSingleMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "Message ID is required",
      });
    }

    const result = await ConversationManagement.deleteMessageById(messageId);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Message not found or already deleted",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully",
      data: { messageId: Number(messageId) },
    });
  } catch (error) {
    console.error("Error deleting single message:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while deleting message",
      error: error.message,
    });
  }
};