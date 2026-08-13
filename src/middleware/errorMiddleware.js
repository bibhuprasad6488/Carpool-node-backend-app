const logger = require("../config/logger");

module.exports = (err, req, res) => {
    logger.error({
        message: err.message || "Internal Server Error",
        stack: err.stack
    });

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    return res.status(statusCode).json({
        status: "error",
        message: message
    });
};