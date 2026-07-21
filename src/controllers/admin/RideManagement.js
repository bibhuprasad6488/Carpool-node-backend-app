const Ride = require("../../models/Ride");

exports.getAllRides = async(req, res) =>{
    try {
        const rides = await Ride.getAllRides();
        return res.status(200).json({
            status:"success",
            data: rides
        })
    } catch (error) {
        return res.status(500).json({
            status:"error",
            message:error.message
        })
    }
}