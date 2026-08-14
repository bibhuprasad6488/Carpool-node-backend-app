const User = require("../models/User");
const Role = require("../models/Role");
const logger = require("../config/logger");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { sendUserNotification } = require("../utils/notificationService");
// const transporter = require("../config/mail");
const APP_URL = process.env.APP_URL;

exports.index = async (req, res) => {
  try {
    const users = await User.getAll();
    res.json(users);
  } catch (error) {
    // console.error(error);
    logger.error(error);
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.edit = async (req, res) => {
  try {
    const user = await User.getUserWithDetails(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Required profile fields/documents
    const requiredFields = [
      "city",
      "state",
      "country",
      "postal_code",
      "address",

      "bank_account_holder",
      "bank_account_number",
      "bank_account_ifsc",
      "bank_name",

      "driver_license",
      "adhhar_card",
      "pan_card",
      "bank_account",

      "profile_picture",
    ];

    // Check whether all required fields are populated
    const profileCompleted = requiredFields.every((field) => {
      const value = user[field];

      return (
        value !== null && value !== undefined && String(value).trim() !== ""
      );
    });

    user.profileCompleted = profileCompleted;
    // Verification status
    user.isVerified = String(user.is_verified) === "1";
    return res.json(user);
  } catch (error) {
    // console.error(error);
    logger.error(error);
    return res.status(500).json({
      status: "error",
      message: error.message,
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
    // console.error(err);
    logger.error(err);
    return res.status(500).json({
      status: "error",
      message: "Unable to fetch roles",
    });
  }
};

exports.register = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { name, email, phone, password, role_id } = req.body;

    // Basic Validations
    if (!name || !email || !password || !role_id) {
      return res.status(422).json({
        status: "error",
        message: "Name, email, password, and role_id are required.",
      });
    }

    // Check existing email
    const [existing] = await connection.query(
      "SELECT id FROM users WHERE email=? LIMIT 1",
      [email.trim()],
    );
    if (existing.length > 0) {
      return res
        .status(422)
        .json({ status: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await connection.beginTransaction();

    // 1. Create Base User
    await connection.query("SET time_zone = '+05:30'");

    const [userResult] = await connection.query(
      `INSERT INTO users (name, email, phone, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [name, email, phone, hashedPassword, role_id],
    );

    // const [userResult] = await connection.query(`INSERT INTO users    (name, email, phone, password, role, created_at, updated_at)    VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP() + INTERVAL 5 HOUR + INTERVAL 30 MINUTE, UTC_TIMESTAMP() + INTERVAL 5 HOUR + INTERVAL 30 MINUTE)`, [name, email, phone, hashedPassword, role_id]);

    const userId = userResult.insertId;
    await connection.commit();

    // 2. Fetch Details
    const userData = await User.getUserWithDetails(userId);
    const registeredUser = userData;

    const token = jwt.sign(
      { id: userId, email: email, role: role_id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    sendUserNotification({
      userId: userId,
      type: "LOGIN_SUCCESS",
      title: "New Login Detected",
      message: `You successfully logged in. If this wasn't you, please secure your account immediately.`,
      data: {
        user: userData,
      },
    });

    return res.status(201).json({
      status: "success",
      message: "Registration successful",
      token,
      user: registeredUser,
    });
  } catch (err) {
    await connection.rollback();
    // console.error(err);
    logger.error(err);
    return res.status(500).json({ status: "error", message: err.message });
  } finally {
    connection.release();
  }
};

exports.updateUserDetails = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      city,
      state,
      country,
      postal_code,
      address,
      bank_account_holder,
      bank_account_number,
      bank_account_ifsc,
      bank_branch_name,
    } = req.body;

    const userId = req.user.id;

    await connection.beginTransaction();

    // Get existing user details
    const [existingDetails] = await connection.query(
      `SELECT *
            FROM user_details
            WHERE user_id = ?
            LIMIT 1`,
      [userId],
    );

    // Keep existing file URLs if no new file is uploaded
    const driver_license =
      req.files?.driver_license?.[0]?.path ??
      existingDetails[0]?.driver_license ??
      null;
    const adhhar_card =
      req.files?.adhhar_card?.[0]?.path ??
      existingDetails[0]?.adhhar_card ??
      null;
    const pan_card =
      req.files?.pan_card?.[0]?.path ?? existingDetails[0]?.pan_card ?? null;
    const bank_account =
      req.files?.bank_account?.[0]?.path ??
      existingDetails[0]?.bank_account ??
      null;
    const profile_picture =
      req.files?.profile_picture?.[0]?.path ??
      existingDetails[0]?.profile_picture ??
      null;

    if (existingDetails.length > 0) {
      // Update existing details
    await connection.query("SET time_zone = '+05:30'");

      await connection.query(
        `UPDATE user_details
            SET
              city = ?,
              state = ?,
              country = ?,
              postal_code = ?,
              address = ?,
              bank_account_holder = ?,
              bank_account_number = ?,
              bank_account_ifsc = ?,
              bank_name = ?,
              driver_license = ?,
              adhhar_card = ?,
              pan_card = ?,
              bank_account = ?,
              profile_picture = ?,
              updated_at = NOW()
              WHERE user_id = ?`,
        [
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
          profile_picture,
          userId,
        ],
      );
    } else {
      // Create user details
    await connection.query("SET time_zone = '+05:30'");

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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
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
          profile_picture,
        ],
      );
    }

    await connection.commit();

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
    });
  } catch (err) {
    await connection.rollback();

    logger.error(err);

    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  } finally {
    connection.release();
  }
};

exports.checkPhone = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(422).json({
        status: "error",
        message: "Phone is required",
      });
    }

    const [user] = await db.query(
      "SELECT id FROM users WHERE phone=? LIMIT 1",
      [phone],
    );

    if (user.length === 0) {
      return res.json({
        status: false,
        message: "User not found",
      });
    }

    return res.json({
      status: true,
    });
  } catch (err) {
    // console.error(err);
    logger.error(err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(422).json({
        status: "error",
        message: "Phone is required",
      });
    }

    const [user] = await db.query(
      "SELECT id FROM users WHERE phone=? LIMIT 1",
      [phone],
    );

    if (user.length === 0) {
      return res.json({
        status: "error",
        message: "No record found on this number",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    await db.query("UPDATE users SET otp=?,updated_at=NOW() WHERE phone=?", [
      otp,
      phone,
    ]);

    // TODO
    // Send OTP using SMS Gateway

    return res.json({
      status: "success",
      message: "An OTP has been sent to your mobile number",
      otp,
    });
  } catch (err) {
    // console.error(err);
    logger.error(err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(422).json({
        status: "error",
        message: "Phone and OTP are required",
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
      [phone],
    );

    if (users.length === 0) {
      return res.json({
        status: "error",
        message: "No data found for this number",
      });
    }

    const user = users[0];
    if (String(user.otp) !== String(otp)) {
      return res.json({
        status: "error",
        message: "Wrong OTP",
      });
    }

    const updated = new Date(user.updated_at);
    const expiry = new Date(updated.getTime() + 60000);

    if (new Date() > expiry) {
      return res.json({
        status: "error",
        message: "OTP is invalid/expired",
      });
    }

    await db.query("UPDATE users SET otp_verified_at=NOW() WHERE id=?", [
      user.id,
    ]);
    if (user.profile_picture && !user.profile_picture.startsWith("http")) {
      user.profile_picture = `${APP_URL}/uploads/user/${user.profile_picture}`;
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "30d",
      },
    );

    return res.json({
      status: "success",
      message: "Login successful",
      user,
      token,
    });
  } catch (err) {
    // console.error(err);
    logger.error(err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

exports.passwordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(422).json({
        status: "error",
        message: "Email is required",
      });
    }

    const [user] = await db.query(
      "SELECT id FROM users WHERE email=? LIMIT 1",
      [email],
    );

    if (user.length === 0) {
      return res.status(422).json({
        status: "error",
        message: "Email not found",
      });
    }

    // Generate OTP
    // Send Email
    // Save OTP

    return res.json({
      status: "success",
      message: "Password reset link/OTP sent.",
    });
  } catch (err) {
    // console.error(err);
    logger.error(err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

exports.getLoginUser = async (req, res) => {
  const userId = req.user.id;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }
    const userDetails = await User.getUserDetailsById(userId);
    if (userDetails) {
      user.user_details = userDetails;
    }
    return res.status(200).json({
      status: "success",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_verified: user.is_verified,
        status: user.status,
        user_details: userDetails,
      },
    });
  } catch (error) {
    // console.error(error);
    logger.error(error);

    return res.status(500).json({
      status: "success",
      message: "Unable to fetch",
    });
  }
};

exports.getProfileStatus = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const userDetails = await User.getUserWithDetails(userId);

    // No profile details found
    if (!userDetails) {
      return res.status(200).json({
        status: "success",
        data: {
          profileCompleted: false,
          isVerified: false,
        },
      });
    }

    // Required profile fields/documents
    const requiredFields = [
      "city",
      "state",
      "country",
      "postal_code",
      "address",

      "bank_account_holder",
      "bank_account_number",
      "bank_account_ifsc",
      "bank_name",

      "driver_license",
      "adhhar_card",
      "pan_card",
      "bank_account",

      "profile_picture",
    ];

    // Check whether all required fields are populated
    const profileCompleted = requiredFields.every((field) => {
      const value = userDetails[field];

      return (
        value !== null && value !== undefined && String(value).trim() !== ""
      );
    });

    // Final verification status
    const isVerified = String(userDetails.is_verified) === "1";

    return res.status(200).json({
      status: "success",
      data: {
        profileCompleted,
        isVerified,
        profileStatus: userDetails.status,
      },
    });
  } catch (error) {
    logger.error(error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

exports.logout = async (req, res) => {
  return res.json({
    status: "success",
    message: "Logout successful",
  });
};
