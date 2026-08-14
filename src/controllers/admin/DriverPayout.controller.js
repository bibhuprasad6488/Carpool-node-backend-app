// controllers/adminPayoutController.js

const DriverPayout = require("../../models/admin/DriverPayout.model");
const { executeAdminPayout } = require("../../services/payoutService");

class AdminPayoutController {
  // Fetch all driver payouts (with pagination and optional status filter)
  static async getPayouts(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const data = await DriverPayout.getAllPaginated(page, limit, status);

      return res.status(200).json({
        success: true,
        data: data.payouts,
        pagination: data.pagination,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch payouts list.",
        error: error.message,
      });
    }
  }

  // Get detailed view of single payout record
  static async getPayoutById(req, res) {
    try {
      const { payoutId } = req.params;
      const payout = await DriverPayout.findById(payoutId);

      if (!payout) {
        return res.status(404).json({
          success: false,
          message: "Payout record not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: payout,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch payout details.",
        error: error.message,
      });
    }
  }

  // Admin Action: Click "Pay Driver"
  static async processPayout(req, res) {
    try {
      const { payoutId } = req.params;
      const result = await executeAdminPayout(payoutId);

      return res.status(200).json({
        success: true,
        message: `Successfully processed payout of ₹${result.netPayoutAmount} to driver.`,
        data: result,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "Payout processing failed.",
      });
    }
  }
}

module.exports = AdminPayoutController;