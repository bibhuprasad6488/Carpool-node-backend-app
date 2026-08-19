const DriverEarnings = require("../models/DriverEarning")

exports.getEarnings = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { filter = "this_week" } = req.query;

    const validFilters = ["this_week", "this_month", "last_3_months", "this_year"];
    const activeFilter = validFilters.includes(filter) ? filter : "this_week";

    const earningsData = await DriverEarnings.getDriverEarningsData(
      driverId,
      activeFilter
    );

    return res.status(200).json({
      success: true,
      data: earningsData,
    });
  } catch (error) {
    console.error("[EARNINGS API ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve earnings details",
    });
  }
};