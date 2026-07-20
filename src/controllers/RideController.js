const Ride = require("../models/Ride");
const GoogleMapService = require("../services/GoogleMapService");
const db = require("../config/db"); // mysql2/promise connection
const Vehicle = require("../models/Vehicle");
const User = require("../models/User");

exports.index = async (req, res) => {
    try {
        const { travel_date } = req.query;

        const rides = await Ride.getAllRides(travel_date);

        return res.status(200).json({
            status: "success",
            data: rides
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            status: "error",
            message: "Something went wrong."
        });
    }
};

exports.findRides = async (req, res) => {
    try {
        const { source_address, destination_address, ride_date, no_of_seats } = req.body;

        // Validation
        if (!source_address)
            return res.status(422).json({
                status: "error",
                message: "Source address is required"
            });

        if (!destination_address)
            return res.status(422).json({
                status: "error",
                message: "Destination address is required"
            });

        if (!ride_date)
            return res.status(422).json({
                status: "error",
                message: "Ride date is required"
            });

        if (!no_of_seats)
            return res.status(422).json({
                status: "error",
                message: "Number of seats is required"
            });

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

exports.searchLocations = async (req, res) => {
    try {
        const { keyword } = req.body;

        if (!keyword) {
            return res.status(422).json({
                status: "error",
                message: "Keyword is required"
            });
        }

        const locations = await Ride.searchLocations(keyword);

        return res.status(200).json(locations);

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            status: "error",
            message: err.message
        });
    }
};

exports.store = async (req, res) => {

    const {
        driver_id,
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
        destination_place_id
    } = req.body;

    // Custom Validation
    if (!driver_id)
        return res.status(422).json({
            status: "error",
            message: "Driver is required."
        });

    if (!vehicle_id)
        return res.status(422).json({
            status: "error",
            message: "Vehicle is required."
        });

    if (!source_address)
        return res.status(422).json({
            status: "error",
            message: "Source address is required."
        });

    if (!destination_address)
        return res.status(422).json({
            status: "error",
            message: "Destination address is required."
        });

    if (!source_lat || !source_lng)
        return res.status(422).json({
            status: "error",
            message: "Source coordinates are required."
        });

    if (!destination_lat || !destination_lng)
        return res.status(422).json({
            status: "error",
            message: "Destination coordinates are required."
        });

    if (!ride_date)
        return res.status(422).json({
            status: "error",
            message: "Ride date is required."
        });

    if (!departure_time)
        return res.status(422).json({
            status: "error",
            message: "Departure time is required."
        });

    if (!price_per_seat)
        return res.status(422).json({
            status: "error",
            message: "Price per seat is required."
        });

    if (!total_seats)
        return res.status(422).json({
            status: "error",
            message: "Total seats is required."
        });

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        // Check Driver
        const [driver] = await connection.execute(
            "SELECT id FROM users WHERE id = ? LIMIT 1",
            [driver_id]
        );

        if (driver.length === 0) {

            await connection.rollback();

            return res.status(422).json({
                status: "error",
                message: "Driver not found."
            });
        }

        // Check Vehicle
        const [vehicle] = await connection.execute(
            "SELECT id FROM vehicles WHERE id = ? LIMIT 1",
            [vehicle_id]
        );

        if (vehicle.length === 0) {

            await connection.rollback();

            return res.status(422).json({
                status: "error",
                message: "Vehicle not found."
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Calculate Departure DateTime
        |--------------------------------------------------------------------------
        */

        const departureDateTime = new Date(`${ride_date} ${departure_time}`);

        // Unix Timestamp (same as Carbon->timestamp)
        const departureTimestamp = Math.floor(
            departureDateTime.getTime() / 1000
        );

        /*
        |--------------------------------------------------------------------------
        | Google Route Details
        |--------------------------------------------------------------------------
        */
        const route = await GoogleMapService.getRouteDetails(
            source_lat,
            source_lng,
            destination_lat,
            destination_lng,
            departureTimestamp
        );

        // /*
        // Expected Response

        // { polyline, distance, duration_in_traffic}
        // */

        // /*
        // |--------------------------------------------------------------------------
        // | Decode Polyline
        // |--------------------------------------------------------------------------
        // */

        const routePoints = GoogleMapService.decodePolyline(
            route.polyline
        );

        // /*
        // |--------------------------------------------------------------------------
        // | Estimated Arrival Time
        // |--------------------------------------------------------------------------
        // */

        const estimatedArrival = new Date(
            departureDateTime.getTime() +
            (route.duration_in_traffic * 1000)
        );

        // Format HH:mm:ss
        const estimatedReachTime = estimatedArrival
            .toTimeString()
            .split(" ")[0];

        // /*
        // |--------------------------------------------------------------------------
        // | Save Source Location (if not exists)
        // |--------------------------------------------------------------------------
        // */

        if (source_place_id) {

            const [sourceLocation] = await connection.execute(
                `
        SELECT id
        FROM locations
        WHERE google_place_id = ?
        LIMIT 1
        `,
                [source_place_id]
            );

            if (sourceLocation.length === 0) {

                await connection.execute(
                    `
            INSERT INTO locations
            (
                name,
                latitude,
                longitude,
                google_place_id,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, NOW(), NOW())
            `,
                    [
                        source_address,
                        source_lat,
                        source_lng,
                        source_place_id
                    ]
                );

            }

        }

        /*
        |--------------------------------------------------------------------------
        | Save Destination Location (if not exists)
        |--------------------------------------------------------------------------
        */

        if (destination_place_id) {

            const [destinationLocation] = await connection.execute(
                `
        SELECT id
        FROM locations
        WHERE google_place_id = ?
        LIMIT 1
        `,
                [destination_place_id]
            );

            if (destinationLocation.length === 0) {

                await connection.execute(
                    `
            INSERT INTO locations
            (
                name,
                latitude,
                longitude,
                google_place_id,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, NOW(), NOW())
            `,
                    [
                        destination_address,
                        destination_lat,
                        destination_lng,
                        destination_place_id
                    ]
                );

            }

        }

        // /*
        // |--------------------------------------------------------------------------
        // | Create Ride
        // |--------------------------------------------------------------------------
        // */

        const [result] = await connection.execute(
            `
    INSERT INTO rides
    (
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
        route_points,
        ride_date,
        departure_time,
        estimated_reach_time,
        polyline,
        distance_meters,
        duration_seconds,
        price_per_seat,
        total_seats,
        available_seats,
        pet_allowed,
        smoking_allowed,
        instant_booking,
        max_two_in_back,
        status,
        created_at,
        updated_at
    )
    VALUES
    (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, 'scheduled', NOW(), NOW()
    )
    `,
            [
                driver_id,
                vehicle_id,
                source_address,
                destination_address,
                source_place_id || null,
                destination_place_id || null,
                source_lat,
                source_lng,
                destination_lat,
                destination_lng,
                JSON.stringify(routePoints),
                ride_date,
                departure_time,
                estimatedReachTime,
                route.polyline,
                route.distance,
                route.duration_in_traffic,
                price_per_seat,
                total_seats,
                total_seats, // available_seats
                pet_allowed || "no",
                smoking_allowed || "no",
                instant_booking || "no",
                max_two_in_back || "no"
            ]
        );

        const rideId = result.insertId;

        /*
        |--------------------------------------------------------------------------
        | Commit Transaction
        |--------------------------------------------------------------------------
        */

        await connection.commit();

        /*
        |--------------------------------------------------------------------------
        | Success Response
        |--------------------------------------------------------------------------
        */

        return res.status(201).json({
            status: "success",
            message: "Ride published successfully.",
            ride_id: rideId
        });

    } catch (err) {

        await connection.rollback();
        console.error(err);

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    } finally {

        connection.release();

    }

};

exports.edit = async (req, res) => {
    try {
        const { id } = req.params;
        const ride = await Ride.rideDetailsById(id);

        if (!ride) {
            return res.status(404).json({
                status: "error",
                message: "Ride not found."
            });
        }

        return res.status(200).json({
            status: "success",
            ride
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            status: "error",
            message: err.message
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
                message: "Ride not found."
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
                user_details: userDetails
            };
        }

        return res.status(200).json({
            status: "success",
            ride: rideFormatData(ride)
        });

    } catch (err) {

        console.error(err);
        return res.status(500).json({
            status: "error",
            message: err.message
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
    }
}