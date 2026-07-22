const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const APP_URL = process.env.APP_URL;

exports.userLogin = async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Request body is missing.",
    });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({
      status: "error",
      message: "Email and password are required",
    });
  }

  const user = await User.findByEmail(email);

  if (!user) {
    return res.status(401).json({
      status: "error",
      message: "Invalid credentials",
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({
      status: "error",
      message: "Invalid credentials",
    });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  const userDetails = await User.getUserDetailsById(user.id);

  if (userDetails) {
    if (userDetails.profile_picture) {
      const isFullUrl =
        userDetails.profile_picture.startsWith("http://") ||
        userDetails.profile_picture.startsWith("https://");

      if (!isFullUrl) {
        userDetails.profile_picture = `${APP_URL}/uploads/user/${userDetails.profile_picture}`;
      }
    } else {
      userDetails.profile_picture = "";
    }
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
    },
  });
};
