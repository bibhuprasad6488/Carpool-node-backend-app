const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const APP_URL = process.env.APP_URL;

// Helper to safely format file URLs
const formatUrl = (filePath) => {
    if (!filePath) return "";
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
        return filePath; // Cloudinary URL—leave as is
    }
    return `${APP_URL}/uploads/user/${filePath}`;
};

exports.userLogin = async (req, res) => {
    if (!req.body) {
        return res.status(400).json({ status: "error", message: "Request body missing." });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(422).json({ status: "error", message: "Email and password required." });
    }

    const user = await User.findByEmail(email);
    if (!user) {
        return res.status(401).json({ status: "error", message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(401).json({ status: "error", message: "Invalid credentials" });
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

    const userDetails = await User.getUserDetailsById(user.id);

    if (userDetails) {
        userDetails.profile_picture = formatUrl(userDetails.profile_picture);
        userDetails.driver_license = formatUrl(userDetails.driver_license);
        userDetails.adhhar_card = formatUrl(userDetails.adhhar_card);
        userDetails.pan_card = formatUrl(userDetails.pan_card);
        userDetails.bank_account = formatUrl(userDetails.bank_account);
    }

    return res.status(200).json({
        status: "success",
        message: "Login successful",
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            user_details: userDetails,
        }
    });
};