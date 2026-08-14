// services/payoutService.js
const db = require("../config/db");
const crypto = require("crypto");
const DriverPayout = require("../models/admin/DriverPayout.model");

const stageDriverPayout = async (rideId, existingConnection = null) => {
  const logPrefix = `[PAYOUT STAGING | Ride ID: ${rideId}]`;
  let connection = existingConnection;
  let isNewTransaction = false;

  try {
    if (!connection) {
      connection = await db.getConnection();
      await connection.beginTransaction();
      isNewTransaction = true;
    }

    // 1. Fetch Ride & Driver Details
    // NOTE: If using the existing connection, the ride is already updated,
    // so no need for FOR UPDATE if called right after completeRideWithBookings
    const [rides] = await connection.query(
      `SELECT id, driver_id, status FROM rides WHERE id = ?`,
      [rideId],
    );

    if (!rides.length || rides[0].status !== "completed") {
      const status = rides[0]?.status || "NOT_FOUND";
      throw new Error(
        `Ride invalid or incomplete (Current status: ${status}).`,
      );
    }

    const ride = rides[0];

    // 2. Check if payout already exists using the same connection
    const [existing] = await connection.query(
      `SELECT id FROM driver_payouts WHERE ride_id = ? LIMIT 1`,
      [rideId],
    );

    if (existing.length > 0) {
      if (isNewTransaction) await connection.commit();
      return existing[0];
    }

    // 3. Fetch Driver Bank Details
    const [userDetails] = await connection.query(
      `SELECT bank_account_number, bank_account_ifsc FROM user_details WHERE user_id = ?`,
      [ride.driver_id],
    );

    if (!userDetails.length || !userDetails[0].bank_account_number) {
      throw new Error(
        `Driver (User ID: ${ride.driver_id}) missing bank account details.`,
      );
    }

    const { bank_account_number, bank_account_ifsc } = userDetails[0];

    // 4. Get Commission
    const [settings] = await connection.query(
      `SELECT commision FROM site_settings ORDER BY id ASC LIMIT 1`,
    );
    const commissionPercent = parseFloat(settings[0]?.commision || 0);

    // 5. Calculate Gross Earnings
    const [earningsResult] = await connection.query(
      `SELECT COALESCE(SUM(total_price), 0.00) AS total_gross 
       FROM ride_bookings 
       WHERE ride_id = ? AND status IN ('confirmed', 'completed') AND payment_status = 'paid'`,
      [rideId],
    );

    const grossAmount = parseFloat(earningsResult[0].total_gross || 0);

    if (grossAmount <= 0) {
      if (isNewTransaction) await connection.commit();
      return null;
    }

    // 6. Calculate Fees
    const platformFee = parseFloat(
      ((grossAmount * commissionPercent) / 100).toFixed(2),
    );
    const netPayoutAmount = parseFloat((grossAmount - platformFee).toFixed(2));
    const payoutCode = `POUT-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

    // 7. Insert Driver Payout using the connection
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

    // Pass connection to DriverPayout.create if supported, or run query directly
    await DriverPayout.create(payoutData, connection);

    if (isNewTransaction) {
      await connection.commit();
    }

    console.log(
      `✅ ${logPrefix} Successfully staged payout code: ${payoutCode}`,
    );
    return payoutData;
  } catch (error) {
    if (isNewTransaction && connection) {
      await connection.rollback();
    }
    console.error(`❌ ${logPrefix} Execution failed:`, error.stack || error);
    throw error;
  } finally {
    if (isNewTransaction && connection) {
      connection.release();
    }
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
      throw new Error(
        `Payout cannot be processed in '${payout.status}' status.`,
      );
    }

    // Mark as processing
    await DriverPayout.updateStatus(
      payoutId,
      "processing",
      null,
      null,
      connection,
    );
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
    await DriverPayout.updateStatus(
      payoutId,
      "completed",
      mockGatewayPayoutId,
      null,
    );

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
