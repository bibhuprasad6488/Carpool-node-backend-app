// workers/sosWorker.js
const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const logger = require("../config/logger"); 

const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

const sosWorker = new Worker(
  "sosQueue",
  async (job) => {
    const { sosId, rideId, userId, driverId, latitude, longitude } = job.data;

    // TODO: Later when you implement Twilio, fetch user/driver numbers and send SMS here.
    logger.info(`[BACKGROUND WORKER] Processing SOS Alert #${sosId} for Ride #${rideId}`);
    console.log(`[SOS QUEUE] Triggered by User #${userId} for Ride #${rideId} at Lat: ${latitude}, Lng: ${longitude}`);
    
    // Simulate async work or placeholder task success
    return { processed: true, sosId };
  },
  { connection }
);

sosWorker.on("completed", (job) => {
  logger.info(`SOS job ${job.id} completed successfully.`);
});

sosWorker.on("failed", (job, err) => {
  logger.error(`SOS job ${job.id} failed with error: ${err.message}`);
});

module.exports = sosWorker;