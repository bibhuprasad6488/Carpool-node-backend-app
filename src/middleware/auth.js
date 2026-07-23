const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // 1. Check if Authorization header exists and follows 'Bearer <token>' pattern
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: "error",
                message: 'Access token required in format: Bearer <token>'
            });
        }

        // 2. Extract token safely
        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                status: "error",
                message: 'Token missing from authorization header'
            });
        }

        // 3. Verify secret exists in environment
        if (!process.env.JWT_SECRET) {
            console.error("CRITICAL ERROR: JWT_SECRET environment variable is not defined.");
            return res.status(500).json({
                status: "error",
                message: 'Server authentication configuration error'
            });
        }

        // 4. Verify token and decode payload
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 5. Attach decoded payload (contains user id, role, email, etc.) to request
        req.user = decoded;
        
        return next();

    } catch (error) {
        const isExpired = error.name === 'TokenExpiredError';

        return res.status(401).json({
            status: "error",
            message: isExpired ? 'Token has expired' : 'Invalid token'
        });
    }
};