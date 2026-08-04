const { Queue } = require("bullmq");
const IORedis = require("ioredis");

// Setup Redis connection (adjust host/port or use process.env as needed)
const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

const sosQueue = new Queue("sosQueue", { connection });

module.exports = sosQueue;