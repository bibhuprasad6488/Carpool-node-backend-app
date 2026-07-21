const Ride = require("../../models/Ride");
const User = require("../../models/User");

exports.getAllUsers = async (req, res) => {
    const users = await User.getAll();
    return res.status(200).json({
        status: "success",
        data: users,
    });
};