const PaymentModel = require("../../models/admin/paymentModel");

const paymentController = {
  async getAllPayments(req, res) {
    try {
      const { page, limit, status, gateway, search } = req.query;

      const result = await PaymentModel.findAll({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        status,
        gateway,
        search,
      });

      return res.status(200).json({
        success: true,
        message: "Payments fetched successfully",
        data: result.payments,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Error fetching payments:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async getPaymentById(req, res) {
    try {
      const { id } = req.params;
      const payment = await PaymentModel.findById(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment record not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment details fetched successfully",
        data: payment,
      });
    } catch (error) {
      console.error("Error fetching payment by ID:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async updatePaymentStatus(req, res) {
    try {
      const { id } = req.params;
      const { payment_status, refund_id, refunded_at } = req.body;

      const updated = await PaymentModel.updateStatus(id, {
        payment_status,
        refund_id,
        refunded_at,
      });

      if (!updated) {
        return res.status(400).json({
          success: false,
          message:
            "Failed to update payment record or no valid fields provided",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment updated successfully",
      });
    } catch (error) {
      console.error("Error updating payment status:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async getPassengerTransactions(req, res) {
    try {
      const { passengerId } = req.params;
      const { page, limit, status } = req.query;

      if (!passengerId) {
        return res.status(400).json({
          success: false,
          message: "Passenger ID is required",
        });
      }

      const result = await PaymentModel.findByPassengerId(passengerId, {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        status,
      });

      return res.status(200).json({
        success: true,
        message: `Transactions fetched successfully for passenger #${passengerId}`,
        data: result.transactions,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Error fetching passenger transactions:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = paymentController;
