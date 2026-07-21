const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                status: "error",
                message: 'Access token required'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );
        req.user = decoded;
        next();

    } catch (error) {
        return res.status(401).json({
            status: "error",
            message: 'Invalid or expired token'
        });

    }

};