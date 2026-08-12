const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

// const APP_URL = process.env.APP_URL;

// const formatUrl = (filePath) => {
//     if (!filePath) return "";
//     if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
//         return filePath;
//     }
//     return `${APP_URL}/uploads/user/${filePath}`;
// };

exports.adminLogin = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        status: "error",
        message: "Request body missing.",
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json({
        status: "error",
        message: "Email and password are required.",
      });
    }

    // 1. Fetch user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials.",
      });
    }

    // 2. Validate Password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials.",
      });
    }

    // 3. Strict Admin Access Gate (Role MUST be 1)
    if (Number(user.role) !== 1) {
      return res.status(403).json({
        status: "error",
        message: "Access denied. You do not have admin privileges.",
      });
    }

    // 4. Generate Admin JWT Token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" } 
    );

    // 5. Fetch Admin Data & Format Media URLs
    // const adminDetails = await User.getAdminProfileById(user.id);
    // let profilePictureUrl = null;
    
    // if (adminDetails && adminDetails.profile_picture) {
    //   profilePictureUrl = formatUrl(adminDetails.profile_picture);
    // }

    // 6. Response Payload
    return res.status(200).json({
      status: "success",
      message: "Admin login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role, // Returns 1
        // profile_picture: profilePictureUrl || "",
      },
    });
  } catch (error) {
    console.error("Admin Login Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error during authentication.",
    });
  }
};