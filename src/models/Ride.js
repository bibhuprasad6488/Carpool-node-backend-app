const db = require("../config/db");
const redis = require("../config/redis");

class Ride {
    static async getAllRides(travelDate = null) {
        let sql = `
            SELECT
                r.*,

                u.id AS driver_id,
                u.name AS driver_name,
                u.email AS driver_email,
                u.phone AS driver_phone,

                v.id AS vehicle_id,
                v.vehicle_name,
                v.vehicle_number,
                v.vehicle_type

            FROM rides r

            LEFT JOIN users u
                ON u.id = r.driver_id

            LEFT JOIN vehicles v
                ON v.id = r.vehicle_id
        `;

        const params = [];

        if (travelDate) {
            sql += ` WHERE r.ride_date = ?`;
            params.push(travelDate);
        }

        sql += ` ORDER BY r.id DESC`;

        const [rows] = await db.execute(sql, params);

        return rows;
    }

    static async findRides(data) {

        // const cacheKey = "rides_" + Buffer
        //     .from(JSON.stringify(data))
        //     .toString("base64");

        // // Check Redis Cache
        // const cached = await redis.get(cacheKey);

        // if (cached) {
        //     return JSON.parse(cached);
        // }

        const sql = `
            SELECT
                r.*,

                d.id AS driver_id,

                d.name AS driver_name,
                d.email AS driver_email,
                d.phone AS driver_phone,

                ud.profile_picture,
                ud.is_verified,

                v.id AS vehicle_id,
                v.vehicle_type,
                v.brand,
                v.model,
                v.manufacture_year,
                v.registration_number,
                v.fuel_type

            FROM rides r

            INNER JOIN users d
                ON d.id = r.driver_id

            LEFT JOIN user_details ud
                ON ud.user_id = d.id

            LEFT JOIN vehicles v
                ON v.id = r.vehicle_id

            WHERE
                r.source_address = ?
                AND r.destination_address = ?
                AND DATE(r.ride_date) = ?
                AND r.available_seats >= ?
                AND r.status = 'scheduled'

            ORDER BY r.ride_date ASC
        `;

        const params = [
            data.source_address,
            data.destination_address,
            data.ride_date,
            data.no_of_seats
        ];

        const [rows] = await db.execute(sql, params);

        const rides = rows.map((ride) => ({
            id: ride.id,

            source_address: ride.source_address,
            destination_address: ride.destination_address,

            source_lat: ride.source_lat,
            source_lng: ride.source_lng,

            destination_lat: ride.destination_lat,
            destination_lng: ride.destination_lng,

            ride_date: ride.ride_date,
            departure_time: ride.departure_time,

            distance_meters: ride.distance_meters,
            duration_seconds: ride.duration_seconds,
            estimated_reach_time: ride.estimated_reach_time,

            pet_allowed: ride.pet_allowed,
            smoking_allowed: ride.smoking_allowed,
            instant_booking: ride.instant_booking,
            max_two_in_back: ride.max_two_in_back,

            price_per_seat: ride.price_per_seat,

            total_seats: ride.total_seats,
            available_seats: ride.available_seats,

            status: ride.status,

            driver_id: ride.driver_id,
            driver_name: ride.driver_name,
            driver_email: ride.driver_email,
            driver_phone: ride.driver_phone,

            driver_profile_picture: ride.profile_picture
                ? `${process.env.APP_URL}/uploads/user/${ride.profile_picture}`
                : "",

            driver_is_verified: ride.is_verified,

            vehicle_id: ride.vehicle_id,
            vehicle_type: ride.vehicle_type,
            brand: ride.brand,
            model: ride.model,
            manufacture_year: ride.manufacture_year,
            registration_number: ride.registration_number,
            fuel_type: ride.fuel_type
        }));

        // // Cache for 5 minutes
        // await redis.setEx(
        //     cacheKey,
        //     300,
        //     JSON.stringify(rides)
        // );

        return rides;
    }

    static async searchLocations(keyword) {

        const sql = `
            SELECT DISTINCT source_address AS location
            FROM rides
            WHERE source_address LIKE ?

            UNION

            SELECT DISTINCT destination_address AS location
            FROM rides
            WHERE destination_address LIKE ?

            ORDER BY location
        `;

        const search = `%${keyword}%`;

        const [rows] = await db.execute(sql, [search, search]);

        return rows.map(row => row.location);
    }
}

module.exports = Ride;