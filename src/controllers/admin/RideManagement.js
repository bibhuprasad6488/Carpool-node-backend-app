const RideManagement = require("../../models/admin/Ride.admin");

exports.getAllRides = async(req, res) =>{
    try {
        const rides = await RideManagement.getAll();
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

exports.getRideDetails = async (req, res) => {
  try {
    const { id } = req.params; 

    if (!id) {
      return res.status(400).json({
        status: "fail",
        message: "Ride ID is required",
      });
    }

    const ride = await RideManagement.getRideByIdForAdmin(id);

    if (!ride) {
      return res.status(404).json({
        status: "fail",
        message: "Ride not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: ride,
    });
  } catch (error) {
    console.error("Error fetching ride details:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};