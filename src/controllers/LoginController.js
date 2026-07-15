const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require("../config/db"); // mysql2/promise connection
const APP_URL = process.env.APP_URL;

exports.userLogin = async (req, res) => {

    // console.log("Headers:", req.headers);
    // console.log("Body:", req.body);

    try {
        if (!req.body) {
            return res.status(400).json({
                status: "error",
                message: "Request body is missing."
            });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(422).json({
                status: "error",
                message: 'Email and password are required'
            });
        }

        const user = await User.findByEmail(email);

        if (!user) {
            return res.status(401).json({
                status: "error",
                message: 'Invalid credentials'
            });
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                status: "error",
                message: 'Invalid credentials'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );
        const userDetails = await User.getUserDetailsById(user.id);
        if (userDetails) {
            userDetails.profile_picture = userDetails.profile_picture
                ? `${APP_URL}/uploads/user/${userDetails.profile_picture}`
                : "";
        }
        return res.status(200).json({
            status: "success",
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role:user.role,
                user_details: userDetails,
            }
        });

    } catch (error) {

        return res.status(500).json({
            status: "error",
            message: error.message
        });

    }

};


