// services/payoutService.js
const db = require("../config/db");
const crypto = require("crypto");
const DriverPayout = require("../models/admin/DriverPayout.model");


const stageDriverPayout = async (rideId) => {
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Fetch Ride & Driver Details
    const [rides] = await connection.query(
      `SELECT id, driver_id, status FROM rides WHERE id = ? FOR UPDATE`,
      [rideId]
    );

    if (!rides.length || rides[0].status !== "completed") {
      throw new Error("Ride is either not found or not completed.");
    }

    const ride = rides[0];

    // Check if payout record already exists
    const existingPayout = await DriverPayout.findByRideId(rideId);
    if (existingPayout) {
      await connection.commit();
      return existingPayout;
    }

    // Fetch Driver Bank Details from user_details
    const [userDetails] = await connection.query(
      `SELECT bank_account_number, bank_account_ifsc FROM user_details WHERE user_id = ?`,
      [ride.driver_id]
    );

    if (!userDetails.length || !userDetails[0].bank_account_number) {
      throw new Error(`Driver (User ID: ${ride.driver_id}) has not set up bank account details.`);
    }

    const { bank_account_number, bank_account_ifsc } = userDetails[0];

    // Get dynamic Commission Percentage from site_settings
    const [settings] = await connection.query(
      `SELECT commision FROM site_settings ORDER BY id ASC LIMIT 1`
    );

    const commissionPercent = parseFloat(settings[0]?.commision || 0);

    // Calculate Gross Amount from paid bookings
    const [earningsResult] = await connection.query(
      `SELECT COALESCE(SUM(total_price), 0.00) AS total_gross 
       FROM ride_bookings 
       WHERE ride_id = ? AND status IN ('confirmed', 'completed') AND payment_status = 'paid'`,
      [rideId]
    );

    const grossAmount = parseFloat(earningsResult[0].total_gross || 0);

    if (grossAmount <= 0) {
      await connection.commit();
      return null;
    }

    // Compute Platform Fee & Net Payout
    const platformFee = parseFloat(((grossAmount * commissionPercent) / 100).toFixed(2));
    const netPayoutAmount = parseFloat((grossAmount - platformFee).toFixed(2));
    const payoutCode = `POUT-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

    // Create payout in 'pending' status
    const payoutData = {
      payoutCode,
      rideId,
      driverId: ride.driver_id,
      grossAmount,
      platformFee,
      netPayoutAmount,
      accountNumber: bank_account_number,
      ifscCode: bank_account_ifsc,
    };

    const payoutId = await DriverPayout.create(payoutData);
    await connection.commit();

    return { payoutId, ...payoutData };
  } catch (error) {
    if (connection) await connection.rollback();
    console.error(`❌ [PAYOUT STAGING ERROR] Ride ID ${rideId}:`, error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

/**
 * 2. Called when Admin clicks "Pay Driver"
 */
const executeAdminPayout = async (payoutId) => {
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const payout = await DriverPayout.findById(payoutId, connection);

    if (!payout) {
      throw new Error("Payout record not found.");
    }

    if (payout.status !== "pending" && payout.status !== "failed") {
      throw new Error(`Payout cannot be processed in '${payout.status}' status.`);
    }

    // Mark as processing
    await DriverPayout.updateStatus(payoutId, "processing", null, null, connection);
    await connection.commit();

    // =========================================================
    // GATEWAY EXECUTION PLACEHOLDER (e.g. RazorpayX Payout API)
    // =========================================================
    /*
      const gatewayResponse = await razorpayX.payouts.create({
        bank_account_number: payout.bank_account_number,
        ifsc: payout.bank_account_ifsc,
        amount: Math.round(payout.net_payout_amount * 100), // convert to paise
        reference_id: payout.payout_code
      });
      const gatewayPayoutId = gatewayResponse.id;
    */

    const mockGatewayPayoutId = `gtw_pout_${Date.now()}`;

    // Mark as completed
    await DriverPayout.updateStatus(payoutId, "completed", mockGatewayPayoutId, null);

    return {
      success: true,
      payoutCode: payout.payout_code,
      netPayoutAmount: payout.net_payout_amount,
      gatewayPayoutId: mockGatewayPayoutId,
    };
  } catch (error) {
    if (connection) await connection.rollback();

    // Record failure status
    await DriverPayout.updateStatus(payoutId, "failed", null, error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  stageDriverPayout,
  executeAdminPayout,
};