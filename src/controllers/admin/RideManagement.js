const RideManagement = require("../../models/admin/Ride.admin");

exports.getAllRides = async (req, res) => {
  try {
    const rides = await RideManagement.getAll();
    return res.status(200).json({
      status: "success",
      data: rides,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

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

exports.createRide = async (req, res) => {
  try {
    const rideData = req.body;

    // Basic required field validation
    const requiredFields = [
      "driver_id",
      "vehicle_id",
      "source_address",
      "destination_address",
      "ride_date",
      "departure_time",
      "price_per_seat",
      "total_seats",
    ];

    const missingFields = requiredFields.filter((field) => !rideData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: "fail",
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Default available seats to total seats if not provided
    if (rideData.available_seats === undefined) {
      rideData.available_seats = rideData.total_seats;
    }

    const newRideId = await RideManagement.createRide(rideData);

    return res.status(201).json({
      status: "success",
      message: "Ride created successfully",
      data: {
        ride_id: newRideId,
      },
    });
  } catch (error) {
    console.error("Error creating ride:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while creating ride",
    });
  }
};

exports.updateRide = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        status: "fail",
        message: "Ride ID is required",
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "No update fields provided in request body",
      });
    }

    const updated = await RideManagement.updateRide(id, updateData);

    if (!updated) {
      return res.status(404).json({
        status: "fail",
        message: "Ride not found or no changes made",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Ride updated successfully",
    });
  } catch (error) {
    console.error("Error updating ride:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while updating ride",
    });
  }
};

exports.deleteRide = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        status: "fail",
        message: "Ride ID is required",
      });
    }

    const deleted = await RideManagement.deleteRide(id);

    if (!deleted) {
      return res.status(404).json({
        status: "fail",
        message: "Ride not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Ride deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting ride:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while deleting ride",
    });
  }
};
