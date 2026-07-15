// const { createClient } = require("redis");

// const redis = createClient({
//     url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
// });

// redis.on("error", (err) => {
//     console.error("Redis Client Error:", err);
// });

// (async () => {
//     try {
//         await redis.connect();
//         console.log("✅ Redis Connected");
//     } catch (err) {
//         console.error("❌ Redis Connection Failed:", err.message);
//     }
// })();

// module.exports = redis;