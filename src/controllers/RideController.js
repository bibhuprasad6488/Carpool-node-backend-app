const Ride = require("../models/Ride");
const GoogleMapService = require("../services/GoogleMapService");
const db = require("../config/db"); // mysql2/promise connection
const Vehicle = require("../models/Vehicle");
const User = require("../models/User");
const ActivityLog = require("../models/admin/ActivityLog");
const {
  sendAdminNotification,
  NOTIFICATION_TYPES,
  sendRideRoomNotification,
} = require("../utils/notificationService");
const { logger } = require("@rudranarayan01/logaccent");

exports.index = async (req, res) => {
  try {
    const { travel_date } = req.query;
    const userId = req.user.id;
    const rides = await Ride.getAllRides(travel_date, userId);
    // console.log(rides.length);

    return res.status(200).json({
      status: "success",
      data: {
        rides: rides,
        total_rides: rides.length > 0 ? rides.length : 0,
        total_seat_booked: await Ride.getTotalSeatsByDriver(userId),
        total_earning: await Ride.getTotalEarningsByDriver(userId),
      },
    });
  } catch (error) {
    // console.error(error);
    logger.error(error);

    return res.status(500).json({
      status: "error",
      message: "Something went wrong.",
    });
  }
};

exports.findRides = async (req, res) => {
  try {
    const { source_address, destination_address, ride_date, no_of_seats } =
      req.body;

    // Validation
    if (!source_address)
      return res.status(422).json({
        status: "error",
        message: "Source address is required",
      });

    if (!destination_address)
      return res.status(422).json({
        status: "error",
        message: "Destination address is required",
      });

    if (!ride_date)
      return res.status(422).json({
        status: "error",
        message: "Ride date is required",
      });

    if (!no_of_seats)
      return res.status(422).json({
        status: "error",
        message: "Number of seats is required",
      });

    const rides = await Ride.findRides(req.body);

    return res.json({
      status: "success",
      rides,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

exports.searchLocations = async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword) {
      return res.status(422).json({
        status: "error",
        message: "Keyword is required",
      });
    }

    const locations = await Ride.searchLocations(keyword);

    return res.status(200).json(locations);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

exports.store = async (req, res) => {
  const connection = await db.getConnection();
  const {
    vehicle_id,
    source_address,
    destination_address,
    source_lat,
    source_lng,
    destination_lat,
    destination_lng,
    ride_date,
    departure_time,
    price_per_seat,
    total_seats,
    pet_allowed,
    smoking_allowed,
    instant_booking,
    max_two_in_back,
    source_place_id,
    destination_place_id,
  } = req.body;

  const driver_id = req.user.id;

  // Check in existing ride
  const [activeRide] = await connection.execute(
    `
    SELECT id, departure_time, estimated_reach_time
    FROM rides
    WHERE driver_id = ?
      AND ride_date = ?
      AND estimated_reach_time > ?
    ORDER BY estimated_reach_time DESC
    LIMIT 1
    `,
    [driver_id, ride_date, departure_time],
  );

  if (activeRide.length > 0) {
    return res.status(400).json({
      status: "error",
      message: `You cannot publish a new ride until your previous ride is completed. Previous ride ends at ${activeRide[0].estimated_reach_time}.`,
    });
  }

  const departureDateTime = new Date(`${ride_date} ${departure_time}`);
  const departureTimestamp = Math.floor(departureDateTime.getTime() / 1000);

  const route = await GoogleMapService.getRouteDetails(
    source_lat,
    source_lng,
    destination_lat,
    destination_lng,
    departureTimestamp,
  );

  const routePoints = GoogleMapService.decodePolyline(route.polyline);
  const estimatedArrival = new Date(
    departureDateTime.getTime() + route.duration_in_traffic * 1000,
  );
  const estimatedReachTime = estimatedArrival.toTimeString().split(" ")[0];

  const rideId = await Ride.createRide({
    driver_id,
    vehicle_id,
    source_address,
    destination_address,
    source_place_id,
    destination_place_id,
    source_lat,
    source_lng,
    destination_lat,
    destination_lng,
    routePoints,
    ride_date,
    departure_time,
    estimatedReachTime,
    polyline: route.polyline,
    distance: route.distance,
    duration_in_traffic: route.duration_in_traffic,
    price_per_seat,
    total_seats,
    pet_allowed,
    smoking_allowed,
    instant_booking,
    max_two_in_back,
  });

  await ActivityLog.create({
    user_id: driver_id,
    action: "CREATE_RIDE",
    description: "Driver posted a new ride route",
    entity_type: "rides",
    entity_id: rideId,
    ip_address: req.ip || req.headers["x-forwarded-for"],
    user_agent: req.headers["user-agent"],
    status: "success",
  });

  sendAdminNotification({
    type: NOTIFICATION_TYPES.RIDE_PUBLISHED,
    title: "New Ride Published 🚗",
    message: `New trip published from ${source_address} to ${destination_address}.`,
    data: {
      rideId: rideId,
      driverId: driver_id,
    },
  });

  return res.status(201).json({
    status: "success",
    message: "Ride published successfully.",
    ride_id: rideId,
  });
};

exports.edit = async (req, res) => {
  try {
    const { id } = req.params;
    const ride = await Ride.rideDetailsById(id);

    if (!ride) {
      return res.status(404).json({
        status: "error",
        message: "Ride not found.",
      });
    }

    return res.status(200).json({
      status: "success",
      ride,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

exports.getRideData = async (req, res) => {
  try {
    const { id } = req.params;
    // const { no_of_seats } = req.body;

    const ride = await Ride.rideDetailsById(id);

    if (!ride) {
      return res.status(404).json({
        status: "error",
        message: "Ride not found.",
      });
    }

    // Calculate total price
    // ride.total_price = Number(ride.price_per_seat) * Number(no_of_seats);

    // Vehicle Details
    const vehicleDetails = await Vehicle.getByVehicleId(ride.vehicle_id);

    if (vehicleDetails) {
      ride.vehicle_details = vehicleDetails;
    }

    // Driver Details
    const user = await User.findById(ride.driver_id);

    if (user) {
      const userDetails = await User.getUserDetailsById(user.id);

      ride.driver_details = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        user_details: userDetails,
      };
    }

    return res.status(200).json({
      status: "success",
      ride: rideFormatData(ride),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

exports.getUpcomingRides = async (req, res) => {
  try {
    let { lat, lng } = req.query;

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      lat = process.env.DEFAULT_LAT || 20.2961;
      lng = process.env.DEFAULT_LNG || 85.8245;
    }

    const rides = await Ride.getNearestUpcomingRides(lat, lng, 6);

    return res.status(200).json({
      status: "success",
      applied_coordinates: {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        is_fallback: !req.query.lat || !req.query.lng,
      },
      count: rides.length,
      rides: rides,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// private function for format
function rideFormatData(ride) {
  return {
    id: ride.id,
    driver_id: ride.driver_id,
    vehicle_id: ride.vehicle_id,
    source_address: ride.source_address,
    source_place_id: ride.source_place_id,
    destination_address: ride.destination_address,
    destination_place_id: ride.destination_place_id,
    source_lat: ride.source_lat,
    source_lng: ride.source_lng,
    destination_lat: ride.destination_lat,
    destination_lng: ride.destination_lng,
    ride_date: ride.ride_date,
    departure_time: ride.departure_time,
    polyline: ride.polyline,
    distance_meters: ride.distance_meters,
    duration_seconds: ride.duration_seconds,
    estimated_reach_time: ride.estimated_reach_time,
    pet_allowed: ride.pet_allowed,
    smoking_allowed: ride.smoking_allowed,
    instant_booking: ride.instant_booking,
    max_two_in_back: ride.max_two_in_back,
    price_per_seat: ride.price_per_seat,
    // total_seats: ride.total_seats,
    available_seats: ride.available_seats,
    status: ride.status,
    // total_price: ride.total_price,
    vehicle_details: ride.vehicle_details,
    driver_details: ride.driver_details,
    // route_points: ride.route_points
  };
}

exports.startRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;

    const ride = await Ride.findRideByIdAndDriver(rideId, driverId);

    if (!ride) {
      return res
        .status(404)
        .json({ success: false, message: "Ride not found or unauthorized" });
    }

    if (ride.status === "ongoing") {
      return res
        .status(400)
        .json({ success: false, message: "Ride is already ongoing" });
    }

    // Executes atomic update for both rides and ride_bookings
    await Ride.startRideWithBookings(rideId);

    // Socket real-time broadcast
    sendRideRoomNotification({
      rideId,
      type: NOTIFICATION_TYPES.RIDE_STARTED,
      title: "Ride Started 🚗",
      message: "Your driver has started the journey. Have a safe trip!",
      data: { rideId, driverId },
    });

    return res.status(200).json({
      success: true,
      message: "Ride started and passenger bookings updated to ongoing",
      data: { rideId, status: "ongoing" },
    });
  } catch (error) {
    console.error("[START RIDE ERROR]", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while starting ride" });
  }
};

exports.completeRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;

    const ride = await Ride.findRideByIdAndDriver(rideId, driverId);

    if (!ride) {
      return res
        .status(404)
        .json({ success: false, message: "Ride not found or unauthorized" });
    }

    if (ride.status === "completed") {
      return res
        .status(400)
        .json({ success: false, message: "Ride is already completed" });
    }

    if (ride.status !== "ongoing") {
      return res.status(400).json({
        success: false,
        message: "Only ongoing rides can be marked as completed",
      });
    }

    // 1. Atomically updates rides and ride_bookings to 'completed'
    await Ride.completeRideWithBookings(rideId);

    // 3. Socket real-time broadcast
    sendRideRoomNotification({
      rideId,
      type: NOTIFICATION_TYPES.RIDE_COMPLETED,
      title: "Ride Completed 🎉",
      message:
        "You have reached your destination. Hope you had a great journey!",
      data: { rideId, driverId },
    });

    return res.status(200).json({
      success: true,
      message: "Ride and passenger bookings completed successfully",
      data: { rideId, status: "completed" },
    });
  } catch (error) {
    console.error("[COMPLETE RIDE ERROR]", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while completing ride" });
  }
};

exports.cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body; // Optional cancel reason from request body
    const driverId = req.user.id;

    const ride = await Ride.findRideByIdAndDriver(rideId, driverId);

    if (!ride) {
      return res
        .status(404)
        .json({ success: false, message: "Ride not found or unauthorized" });
    }

    if (ride.status === "cancelled") {
      return res
        .status(400)
        .json({ success: false, message: "Ride is already cancelled" });
    }

    if (ride.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Completed rides cannot be cancelled",
      });
    }

    // Atomically updates rides and ride_bookings to 'cancelled' with cancel_reason
    await Ride.cancelRideWithBookings(rideId, reason || "Cancelled by driver");

    // Socket real-time broadcast
    sendRideRoomNotification({
      rideId,
      type: NOTIFICATION_TYPES.RIDE_CANCELLED,
      title: "Opps..!! Ride Cancelled by driver.",
      message: reason
        ? `The driver cancelled the ride. Reason: ${reason}`
        : "The driver has cancelled this ride.",
      data: { rideId, reason: reason || "Driver cancelled" },
    });

    return res.status(200).json({
      success: true,
      message: "Ride and passenger bookings cancelled successfully",
      data: { rideId, status: "cancelled" },
    });
  } catch (error) {
    console.error("[CANCEL RIDE ERROR]", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while cancelling ride" });
  }
};

exports.getTopCorridors = async function (req, res) {
  try {
    // Optional limit query param, defaults to 5 if not provided or invalid
    const limit = parseInt(req.query.limit, 10) || 5;

    const rawCorridors = await Ride.getTopBookedCorridors(limit);

    // Format output for frontend consumption
    const topCorridors = rawCorridors.map((row) => {
      const trips = Number(row.total_trips || 0);
      const fare = Number(row.avg_fare || 0);

      return {
        route: row.route,
        origin: row.origin,
        destination: row.destination,
        total_trips: trips,
        volume_label: `${trips.toLocaleString("en-IN")} trips`,
        avg_fare: fare,
        fare_label: `₹${fare.toFixed(2)}`,
      };
    });

    return res.status(200).json({
      success: true,
      count: topCorridors.length,
      data: topCorridors,
    });
  } catch (error) {
    console.error("Error fetching top corridors:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve top performing routes.",
      error: error.message,
    });
  }
};
