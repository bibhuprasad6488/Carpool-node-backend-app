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
    const { status, seat, price } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "fail",
        message: "Ride ID is required",
      });
    }

    // Build whitelisted payload
    const updateData = {};

    if (status !== undefined) {
      if (typeof status !== "string" || !status.trim()) {
        return res.status(400).json({
          status: "fail",
          message: "Status must be a valid non-empty string.",
        });
      }
      updateData.status = status.trim();
    }

    if (seat !== undefined) {
      const seatNum = Number(seat);
      if (isNaN(seatNum) || seatNum < 0) {
        return res.status(400).json({
          status: "fail",
          message: "Seats must be a valid non-negative number.",
        });
      }
      // Map frontend 'seat' key to database column name
      updateData.available_seats = seatNum; // adjust column name if different
    }

    if (price !== undefined) {
      const priceNum = Number(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({
          status: "fail",
          message: "Price must be a valid non-negative number.",
        });
      }
      // Map frontend 'price' key to database column name
      updateData.price_per_seat = priceNum; // adjust column name if different
    }

    // Ensure at least one valid field is passed
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: "fail",
        message:
          "At least one valid field (status, seat, price) must be provided.",
      });
    }

    const updated = await RideManagement.updateRide(id, updateData);

    if (!updated) {
      return res.status(404).json({
        status: "fail",
        message: "Ride not found or no changes were made.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Ride updated successfully",
      updatedFields: Object.keys(updateData),
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

exports.getDriverRides = async (req, res) => {
  try {
    const driverId = req.params.driverId || req.user?.id;
    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required.",
      });
    }

    const rides = await RideManagement.getByDriverId(driverId);

    return res.status(200).json({
      success: true,
      count: rides.length,
      data: rides,
    });
  } catch (error) {
    console.error("Error fetching driver rides:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching driver rides.",
      error: error.message,
    });
  }
};

exports.getPassengerRides = async (req, res) => {
  try {
    const passengerId = req.params.passengerId || req.user?.id;
    if (!passengerId) {
      return res.status(400).json({
        success: false,
        message: "Passenger ID is required.",
      });
    }

    const rides = await RideManagement.getByPassengerId(passengerId);

    return res.status(200).json({
      success: true,
      count: rides.length,
      data: rides,
    });
  } catch (error) {
    console.error("Error fetching passenger rides:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching passenger rides.",
      error: error.message,
    });
  }
};

exports.getFullRideDetails = async (req, res) => {
  try {
    const { rideId } = req.params;
    if (!rideId) {
      return res.status(400).json({
        success: false,
        message: "Ride ID is required",
      });
    }

    const data = await RideManagement.getFullRideDetailsById(rideId);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Ride details not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ride details fetched successfully",
      data,
    });
  } catch (error) {
    console.error("Error fetching ride details:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching ride details",
      error: error.message,
    });
  }
};
