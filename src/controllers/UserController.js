const User = require('../models/User');
const Role = require('../models/Role');

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db"); // mysql2/promise connection
const transporter = require("../config/mail");
const APP_URL = process.env.APP_URL;

exports.index = async (req, res) => {

    try {

        const users = await User.getAll();

        res.json(users);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};

exports.edit = async (req, res) => {

    try {

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                status: "error",
                message: 'User not found'
            });
        }

        return res.json(user);

    } catch (error) {

        return res.status(500).json({
            status: "error",
            message: error.message
        });

    }

};

exports.getRoles = async (req, res) => {
    try {

        const { name } = req.query;
        console.log(name);

        const roles = await Role.getAllRoles(name);

        return res.json(roles);

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    }
};


exports.register = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const {
            name,
            email,
            phone,
            password,
            role_id,
            city,
            state,
            country,
            postal_code,
            address,
            bank_account_holder,
            bank_account_number,
            bank_account_ifsc,
            bank_branch_name
        } = req.body;

        // Validation
        if (!name)
            return res.status(422).json({
                status: "error",
                message: "Name is required"
            });

        if (!email)
            return res.status(422).json({
                status: "error",
                message: "Email is required"
            });

        if (!password || password.length < 8)
            return res.status(422).json({
                status: "error",
                message: "Password must be at least 8 characters"
            });

        if (!role_id)
            return res.status(422).json({
                status: "error",
                message: "Role is required"
            });

        // Check email exists
        const [existing] = await connection.query(
            "SELECT id FROM users WHERE email=? LIMIT 1",
            [email.trim()]
        );

        if (existing.length > 0) {
            return res.status(422).json({
                status: false,
                message: "Email already exists"
            });
        }

        // Check role exists
        const [role] = await connection.query(
            "SELECT id FROM roles WHERE id=? LIMIT 1",
            [role_id]
        );

        if (role.length === 0) {
            return res.status(422).json({
                status: false,
                message: "Invalid role."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await connection.beginTransaction();

        // Create User
        const [userResult] = await connection.query(
            `INSERT INTO users
            (name,email,phone,password,role,created_at,updated_at)
            VALUES (?,?,?,?,?,NOW(),NOW())`,
            [
                name,
                email,
                phone,
                hashedPassword,
                role_id
            ]
        );

        const userId = userResult.insertId;

        // Uploaded Files
        const driver_license = req.files?.driver_license?.[0]?.filename || null;
        const adhhar_card = req.files?.adhhar_card?.[0]?.filename || null;
        const pan_card = req.files?.pan_card?.[0]?.filename || null;
        const bank_account = req.files?.bank_account?.[0]?.filename || null;
        const profile_picture = req.files?.profile_picture?.[0]?.filename || null;

        // User Details
        await connection.query(
            `INSERT INTO user_details
            (
                user_id,
                city,
                state,
                country,
                postal_code,
                address,
                bank_account_holder,
                bank_account_number,
                bank_account_ifsc,
                bank_name,
                driver_license,
                adhhar_card,
                pan_card,
                bank_account,
                profile_picture,
                created_at,
                updated_at
            )
            VALUES
            (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
            [
                userId,
                city,
                state,
                country,
                postal_code,
                address,
                bank_account_holder,
                bank_account_number,
                bank_account_ifsc,
                bank_branch_name,
                driver_license,
                adhhar_card,
                pan_card,
                bank_account,
                profile_picture
            ]
        );

        await connection.commit();

        // Fetch User
        const [user] = await connection.query(
            `SELECT
                u.*,
                ud.city,
                ud.state,
                ud.country,
                ud.postal_code,
                ud.address,
                ud.bank_account_holder,
                ud.bank_account_number,
                ud.bank_account_ifsc,
                ud.bank_name,
                ud.driver_license,
                ud.adhhar_card,
                ud.pan_card,
                ud.bank_account,
                ud.profile_picture
            FROM users u
            LEFT JOIN user_details ud
            ON ud.user_id=u.id
            WHERE u.id=?`,
            [userId]
        );
        const userDetails = user[0];

        if (userDetails) {
            userDetails.profile_picture = userDetails.profile_picture
                ? `${APP_URL}/uploads/user/${userDetails.profile_picture}`
                : "";
            userDetails.driver_license = userDetails.driver_license
                ? `${APP_URL}/uploads/user/${userDetails.driver_license}`
                : "";
            userDetails.adhhar_card = userDetails.adhhar_card
                ? `${APP_URL}/uploads/user/${userDetails.adhhar_card}`
                : "";
            userDetails.pan_card = userDetails.pan_card
                ? `${APP_URL}/uploads/user/${userDetails.pan_card}`
                : "";
            userDetails.bank_account = userDetails.bank_account
                ? `${APP_URL}/uploads/user/${userDetails.bank_account}`
                : "";
        }

        const token = jwt.sign(
            {
                id: userId,
                email: email,
                role: role_id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        return res.status(201).json({
            status: "success",
            message: "Registration successful",
            token,
            user: user[0]
        });

    } catch (err) {

        await connection.rollback();

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    } finally {

        connection.release();

    }
};

exports.updateUserDetails = async (req, res) => {
    const {
        name,
        email,
        phone,
        password,
        role_id,
        city,
        state,
        country,
        postal_code,
        address,
        bank_account_holder,
        bank_account_number,
        bank_account_ifsc,
        bank_branch_name
    } = req.body;


};


exports.checkPhone = async (req, res) => {
    try {

        const { phone } = req.body;

        if (!phone) {
            return res.status(422).json({
                status: "error",
                message: "Phone is required"
            });
        }

        const [user] = await db.query(
            "SELECT id FROM users WHERE phone=? LIMIT 1",
            [phone]
        );

        if (user.length === 0) {
            return res.json({
                status: false,
                message: "User not found"
            });
        }

        return res.json({
            status: true
        });

    } catch (err) {

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    }
};

exports.sendOTP = async (req, res) => {

    try {

        const { phone } = req.body;

        if (!phone) {
            return res.status(422).json({
                status: "error",
                message: "Phone is required"
            });
        }

        const [user] = await db.query(
            "SELECT id FROM users WHERE phone=? LIMIT 1",
            [phone]
        );

        if (user.length === 0) {
            return res.json({
                status: "error",
                message: "No record found on this number"
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000);

        await db.query(
            "UPDATE users SET otp=?,updated_at=NOW() WHERE phone=?",
            [otp, phone]
        );

        // TODO
        // Send OTP using SMS Gateway

        return res.json({
            status: "success",
            message: "An OTP has been sent to your mobile number",
            otp
        });

    } catch (err) {

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    }

};

exports.verifyOTP = async (req, res) => {

    try {

        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(422).json({
                status: "error",
                message: "Phone and OTP are required"
            });
        }

        const [users] = await db.query(
            `SELECT
                u.*,
                ud.*
            FROM users u
            LEFT JOIN user_details ud
            ON ud.user_id=u.id
            WHERE u.phone=?
            LIMIT 1`,
            [phone]
        );

        if (users.length === 0) {
            return res.json({
                status: "error",
                message: "No data found for this number"
            });
        }

        const user = users[0];

        if (String(user.otp) !== String(otp)) {
            return res.json({
                status: "error",
                message: "Wrong OTP"
            });
        }

        const updated = new Date(user.updated_at);
        const expiry = new Date(updated.getTime() + 60000);

        if (new Date() > expiry) {
            return res.json({
                status: "error",
                message: "OTP is invalid/expired"
            });
        }

        await db.query(
            "UPDATE users SET otp_verified_at=NOW() WHERE id=?",
            [user.id]
        );

        if (user.profile_picture) {
            user.profile_picture =
                process.env.APP_URL +
                "/uploads/user/" +
                user.profile_picture;
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );

        return res.json({
            status: "success",
            message: "Login successful",
            user,
            token
        });

    } catch (err) {

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    }

};

exports.passwordReset = async (req, res) => {

    try {

        const { email } = req.body;

        if (!email) {
            return res.status(422).json({
                status: "error",
                message: "Email is required"
            });
        }

        const [user] = await db.query(
            "SELECT id FROM users WHERE email=? LIMIT 1",
            [email]
        );

        if (user.length === 0) {
            return res.status(422).json({
                status: "error",
                message: "Email not found"
            });
        }

        // Generate OTP
        // Send Email
        // Save OTP

        return res.json({
            status: "success",
            message: "Password reset link/OTP sent."
        });

    } catch (err) {

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    }

};

exports.logout = async (req, res) => {

    return res.json({
        status: "success",
        message: "Logout successful"
    });

};