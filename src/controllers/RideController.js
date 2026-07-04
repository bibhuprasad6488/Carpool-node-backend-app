const { validationResult } = require("express-validator");
const Ride = require("../models/Ride");

exports.index = async (req, res) => {
    try {
        const { travel_date } = req.query;

        const rides = await Ride.getAllRides(travel_date);

        return res.status(200).json({
            success: true,
            data: rides
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong."
        });
    }
};

exports.findRides = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).json({
                status: "error",
                message: errors.array()[0].msg
            });
        }

        const rides = await Ride.findRides(req.body);

        return res.json({
            status: "success",
            rides
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            status: "error",
            message: err.message
        });
    }
};
