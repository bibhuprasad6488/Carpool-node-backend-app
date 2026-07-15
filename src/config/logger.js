const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const fs = require("fs");
const path = require("path");

const logDir = path.join(__dirname, "../logs");

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "debug",

    format: winston.format.combine(
        winston.format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss"
        }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
            return `[${timestamp}] ${level.toUpperCase()}: ${stack || message}`;
        })
    ),

    transports: [
        new DailyRotateFile({
            filename: path.join(logDir, "log-%DATE%.log"),
            datePattern: "YYYY-MM-DD",
            zippedArchive: false,
            maxSize: process.env.LOG_MAX_SIZE || "20m",
            maxFiles: process.env.LOG_RETENTION_DAYS || "30d"
        }),

        new winston.transports.Console({
            level: process.env.LOG_LEVEL || "debug"
        })
    ]
    // transports: [

    //     // All logs
    //     new DailyRotateFile({
    //         filename: path.join(logDir, "log-%DATE%.log"),
    //         datePattern: "YYYY-MM-DD",
    //         zippedArchive: true,
    //         maxSize: "20m",
    //         maxFiles: "30d"
    //     }),

    //     // Error logs only
    //     new DailyRotateFile({
    //         filename: path.join(logDir, "error-%DATE%.log"),
    //         level: "error",
    //         datePattern: "YYYY-MM-DD",
    //         zippedArchive: true,
    //         maxSize: "20m",
    //         maxFiles: "90d"
    //     }),

    //     // Console
    //     new winston.transports.Console({
    //         level: process.env.LOG_LEVEL || "debug"
    //     })

    // ]
});

module.exports = logger;