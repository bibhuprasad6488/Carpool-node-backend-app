const cron = require("node-cron");
const { handleExpiredRides } = require("./expireRidesTask");

const initCronJobs = () => {
  cron.schedule("*/15 * * * *", async () => {
    console.log("⏰ [CRON] Checking for expired rides...");
    try {
      await handleExpiredRides();
    } catch (err) {
      console.error("❌ [CRON ERROR]", err);
    }
  });

  console.log("⏰ Cron jobs initialized.");
};

module.exports = initCronJobs;