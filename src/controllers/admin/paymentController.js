const PaymentModel = require("../../models/admin/paymentModel");
const razorpay = require("../../config/razorpay");

const paymentController = {
  async getAllPayments(req, res) {
    try {
      const { page, limit, status, gateway, search } = req.query;

      // if (status == "")
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
        stats: result.stats,
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

  async getRefundRequests(req, res) {
    try {
      const { page = 1, limit = 10, status, search } = req.query;

      const result = await PaymentModel.getRefundRequests({
        page: Number(page),
        limit: Number(limit),
        status,
        search,
      });

      return res.status(200).json({
        success: true,
        message: "Refund requests retrieved successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Error fetching refund requests:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve refund requests",
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

  async processRefund(req, res) {
    try {
      const { id } = req.params;
      const { refund_amount, reason_of_refund } = req.body;

      // 1. Fetch payment details
      const payment = await PaymentModel.findById(id);
      if (!payment) {
        return res
          .status(404)
          .json({ success: false, message: "Payment record not found" });
      }

      if (!payment.payment_id) {
        return res.status(400).json({
          success: false,
          message:
            "No payment_id found for this transaction. Cannot process gateway refund.",
        });
      }

      if (
        payment.payment_status !== "paid" &&
        payment.payment_status !== "partially_refund_requested"
      ) {
        return res.status(400).json({
          success: false,
          message: `Cannot process refund for payment in status '${payment.payment_status}'`,
        });
      }

      // 2. Validate refund amount against total payment amount
      const originalAmount = parseFloat(payment.amount || 0);
      const totalRefundedSoFar = await PaymentModel.getRefundedSumByBookingId(
        payment.booking_id,
      );
      const remainingRefundable = originalAmount - totalRefundedSoFar;

      const targetRefundAmount = refund_amount
        ? parseFloat(refund_amount)
        : remainingRefundable;

      if (targetRefundAmount <= 0 || targetRefundAmount > remainingRefundable) {
        return res.status(400).json({
          success: false,
          message: `Invalid refund amount. Maximum refundable amount remaining is ₹${remainingRefundable}`,
        });
      }

      // 3. Log initial entry into refunds table
      const refundRecordId = await PaymentModel.createRefundRecord({
        booking_id: payment.booking_id,
        refund_amount: targetRefundAmount,
        reason_of_refund: reason_of_refund || "Admin triggered refund",
        status: "processing",
      });

      // 4. Call Razorpay API (Amount must be in Paise)
      const razorpayRefund = await razorpay.payments.refund(
        payment.payment_id,
        {
          amount: Math.round(targetRefundAmount * 100),
          notes: {
            booking_id: payment.booking_id,
            booking_code: payment.booking_code,
            reason: reason_of_refund || "Dashboard refund",
          },
        },
      );

      // 5. Update refunds table with Razorpay response
      await PaymentModel.updateRefundRecord(refundRecordId, {
        refund_id: razorpayRefund.id,
        status: "processed",
      });

      // 6. Update payments table with status and MySQL-formatted timestamp
      const isFullRefund =
        totalRefundedSoFar + targetRefundAmount >= originalAmount;
      const formattedTimestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      await PaymentModel.updateStatus(payment.id, {
        payment_status: isFullRefund ? "refunded" : "partially_refunded",
        refund_id: razorpayRefund.id,
        refunded_at: formattedTimestamp, // 2. Safe MySQL DATETIME string
      });

      return res.status(200).json({
        success: true,
        message: "Refund processed successfully via Razorpay",
        data: {
          refund_table_id: refundRecordId,
          razorpay_refund_id: razorpayRefund.id,
          amount: targetRefundAmount,
          status: "processed",
        },
      });
    } catch (error) {
      console.error("Error processing refund:", error);
      return res.status(500).json({
        success: false,
        message:
          error.error?.description ||
          error.message ||
          "Failed to process refund via gateway",
      });
    }
  },

  async handleWebhook(req, res) {
    try {
      const { event, payload } = req.body;
      if (event === "refund.processed") {
        const refundEntity = payload.refund.entity;
        const payment = await PaymentModel.findByPaymentId(
          refundEntity.payment_id,
        );

        if (payment) {
          const formattedTimestamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");
          await PaymentModel.updateStatus(payment.id, {
            payment_status: "refunded",
            refund_id: refundEntity.id,
            refunded_at: formattedTimestamp,
          });
        }
      }

      return res.status(200).json({ status: "ok" });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return res.status(500).send("Webhook handling failed");
    }
  },
};

module.exports = paymentController;
