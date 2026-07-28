const { validationResult } = require("express-validator");
const ConversationManagement = require("../../models/admin/Conversation")


exports.getConversations = async (req, res) =>{
    const conversations = await ConversationManagement.getAll();
    return res.status(200).json({
        status: "success",
        data: conversations,
    });
}

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