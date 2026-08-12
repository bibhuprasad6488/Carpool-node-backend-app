const db = require("../config/db");
// const redis = require("../config/redis");

const formatProfileUrl = (filePath) => {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  return `${process.env.APP_URL}/uploads/user/${filePath}`;
};

class Ride {
  static async getAllRides(travelDate = null, userId = null) {
    let sql = `
        SELECT
            r.id,
            r.driver_id,
            r.vehicle_id,
            r.source_address,
            r.source_place_id,
            r.destination_address,
            r.destination_place_id,
            r.source_lat,
            r.source_lng,
            r.destination_lat,
            r.destination_lng,
            DATE_FORMAT(r.ride_date, '%Y-%m-%d') AS ride_date,
            r.departure_time,
            r.distance_meters,
            r.duration_seconds,
            r.estimated_reach_time,
            r.pet_allowed,
            r.smoking_allowed,
            r.instant_booking,
            r.price_per_seat,
            r.total_seats,
            r.available_seats,
            r.status,
            r.created_at,
            r.updated_at,

            u.name AS driver_name,
            u.email AS driver_email,
            u.phone AS driver_phone,

            v.model,
            v.registration_number,
            v.fuel_type



        FROM rides r

        LEFT JOIN users u
            ON u.id = r.driver_id

        LEFT JOIN vehicles v
            ON v.id = r.vehicle_id
    `;

    const conditions = [];
    const params = [];

    if (travelDate) {
      conditions.push("r.ride_date = ?");
      params.push(travelDate);
    }

    if (userId) {
      conditions.push("r.driver_id = ?");
      params.push(userId);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += ` ORDER BY r.id DESC`;

    const [rows] = await db.execute(sql, params);

    const mapBookings = await Promise.all(
      rows.map(async (ride) => {
        const rideBookings = `
      SELECT
        rb.id AS booking_id,
        rb.booking_code,
        rb.ride_id,
        rb.passenger_id,
        rb.seats AS booked_seats,
        rb.total_price,
        rb.status,
        rb.payment_status,

        p.name AS passenger_name,
        p.email AS passenger_email,
        p.phone AS passenger_phone

      FROM ride_bookings rb

      LEFT JOIN users p
        ON p.id = rb.passenger_id

      WHERE rb.ride_id = ?
    `;

        const [bookingRows] = await db.execute(rideBookings, [ride.id]);

        ride.bookingDetails = bookingRows;

        return ride;
      }),
    );

    return mapBookings;
  }

  static async getTotalSeatsByDriver(driverId) {
    const [rows] = await db.execute(
      `
        SELECT COALESCE(SUM(rb.seats), 0) AS total_booked_seats
        FROM rides r
        LEFT JOIN ride_bookings rb
            ON rb.ride_id = r.id
        WHERE r.driver_id = ?
          AND rb.payment_status = 'paid'
          AND rb.status = 'confirmed'
        `,
      [driverId],
    );

    return rows[0].total_booked_seats;
  }

  static async getTotalEarningsByDriver(driverId) {
    const [rows] = await db.execute(
      `
        SELECT COALESCE(SUM(rb.total_price), 0) AS total_earning
        FROM rides r
        INNER JOIN ride_bookings rb
            ON rb.ride_id = r.id
        WHERE r.driver_id = ?
          AND rb.payment_status = 'paid'
          AND rb.status = 'confirmed'
        `,
      [driverId],
    );

    return Number(rows[0].total_earning);
  }

  static async createRide({
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
    polyline,
    distance,
    duration_in_traffic,
    price_per_seat,
    total_seats,
    pet_allowed,
    smoking_allowed,
    instant_booking,
    max_two_in_back,
  }) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [driver] = await connection.execute(
        "SELECT id FROM users WHERE id = ? LIMIT 1",
        [driver_id],
      );

      if (driver.length === 0) {
        throw { statusCode: 422, message: "Driver not found." };
      }

      const [vehicle] = await connection.execute(
        "SELECT id FROM vehicles WHERE id = ? AND user_id = ? LIMIT 1",
        [vehicle_id, driver_id],
      );

      if (vehicle.length === 0) {
        throw {
          statusCode: 403,
          message: "Unauthorized: Vehicle not found or does not belong to you.",
        };
      }

      if (source_place_id) {
        const [sourceLocation] = await connection.execute(
          "SELECT id FROM locations WHERE google_place_id = ? LIMIT 1",
          [source_place_id],
        );

        if (sourceLocation.length === 0) {
          await connection.execute(
            `INSERT INTO locations (name, latitude, longitude, google_place_id, created_at, updated_at)
                         VALUES (?, ?, ?, ?, NOW(), NOW())`,
            [source_address, source_lat, source_lng, source_place_id],
          );
        }
      }

      if (destination_place_id) {
        const [destinationLocation] = await connection.execute(
          "SELECT id FROM locations WHERE google_place_id = ? LIMIT 1",
          [destination_place_id],
        );

        if (destinationLocation.length === 0) {
          await connection.execute(
            `INSERT INTO locations (name, latitude, longitude, google_place_id, created_at, updated_at)
                         VALUES (?, ?, ?, ?, NOW(), NOW())`,
            [
              destination_address,
              destination_lat,
              destination_lng,
              destination_place_id,
            ],
          );
        }
      }

      const [result] = await connection.execute(
        `INSERT INTO rides
                (
                    driver_id, vehicle_id, source_address, destination_address,
                    source_place_id, destination_place_id, source_lat, source_lng,
                    destination_lat, destination_lng, route_points, ride_date,
                    departure_time, estimated_reach_time, polyline, distance_meters,
                    duration_seconds, price_per_seat, total_seats, available_seats,
                    pet_allowed, smoking_allowed, instant_booking, max_two_in_back,
                    status, created_at, updated_at
                )
                VALUES
                (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, 'scheduled', NOW(), NOW()
                )`,
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
          polyline,
          distance,
          duration_in_traffic,
          price_per_seat,
          total_seats,
          total_seats,
          pet_allowed || "no",
          smoking_allowed || "no",
          instant_booking || "no",
          max_two_in_back || "no",
        ],
      );

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
      data.no_of_seats,
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
      fuel_type: ride.fuel_type,
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

    return rows.map((row) => row.location);
  }

  static async rideDetailsById(id) {
    const sql = `
                SELECT *
                FROM rides
                WHERE id = ?
                LIMIT 1
            `;

    const [rows] = await db.execute(sql, [id]);
    return rows.length ? rows[0] : null;
  }

  static async getNearestUpcomingRides(userLat, userLng, limit = 6) {
    const parsedLat = parseFloat(userLat);
    const parsedLng = parseFloat(userLng);
    const parsedLimit = parseInt(limit, 10) || 6;

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
        v.fuel_type,
        (
          6371 * acos(
            LEAST(1.0, GREATEST(-1.0, 
              cos(radians(?)) * cos(radians(r.source_lat)) *
              cos(radians(r.source_lng) - radians(?)) +
              sin(radians(?)) * sin(radians(r.source_lat))
            ))
          )
        ) AS distance_km
      FROM rides r
      INNER JOIN users d ON d.id = r.driver_id
      LEFT JOIN user_details ud ON ud.user_id = d.id
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      WHERE
        TIMESTAMP(r.ride_date, r.departure_time) >= NOW()
        AND r.available_seats > 0
        AND r.status = 'scheduled'
      ORDER BY distance_km ASC, r.ride_date ASC, r.departure_time ASC
      LIMIT ${parsedLimit}
    `;

    const params = [parsedLat, parsedLng, parsedLat];

    const [rows] = await db.query(sql, params);

    return rows.map((ride) => ({
      id: ride.id,
      distance_km: Math.round((ride.distance_km || 0) * 10) / 10,
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
      driver_profile_picture: formatProfileUrl(ride.profile_picture),
      driver_is_verified: ride.is_verified,
      vehicle_id: ride.vehicle_id,
      vehicle_type: ride.vehicle_type,
      brand: ride.brand,
      model: ride.model,
      manufacture_year: ride.manufacture_year,
      registration_number: ride.registration_number,
      fuel_type: ride.fuel_type,
    }));
  }

  static async findRideByIdAndDriver(rideId, driverId) {
    const [rows] = await db.query(
      "SELECT * FROM rides WHERE id = ? AND driver_id = ? LIMIT 1",
      [rideId, driverId],
    );
    return rows[0] || null;
  }

  static async startRideWithBookings(rideId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Update ride status
      await connection.query(
        `UPDATE rides SET status = 'ongoing', updated_at = NOW() WHERE id = ?`,
        [rideId],
      );

      // 2. Update all active/confirmed bookings for this ride to 'ongoing'
      await connection.query(
        `UPDATE ride_bookings 
       SET status = 'ongoing', updated_at = NOW() 
       WHERE ride_id = ? AND status IN ('accepted', 'confirmed')`,
        [rideId],
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async completeRideWithBookings(rideId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Update ride status
      await connection.query(
        `UPDATE rides SET status = 'completed', updated_at = NOW() WHERE id = ?`,
        [rideId],
      );

      // 2. Update bookings to completed
      await connection.query(
        `UPDATE ride_bookings 
       SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
       WHERE ride_id = ? AND status IN ('ongoing', 'accepted', 'confirmed')`,
        [rideId],
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async cancelRideWithBookings(rideId, cancelReason = null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Update ride status
      await connection.query(
        `UPDATE rides SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
        [rideId],
      );

      // 2. Update active bookings to cancelled
      await connection.query(
        `UPDATE ride_bookings 
       SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = ?, updated_at = NOW() 
       WHERE ride_id = ? AND status NOT IN ('cancelled', 'completed')`,
        [cancelReason, rideId],
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getTopBookedCorridors(limit = 5) {
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 5);

    const query = `
    SELECT 
      CONCAT(r.origin, ' ➔ ', r.destination) AS route,
      r.origin,
      r.destination,
      COUNT(r.id) AS total_trips,
      ROUND(COALESCE(AVG(r.price_per_seat), 0), 2) AS avg_fare
    FROM (
      SELECT 
        id,
        price_per_seat,
        TRIM(SUBSTRING_INDEX(source_address, ',', 1)) AS origin,
        TRIM(SUBSTRING_INDEX(destination_address, ',', 1)) AS destination
      FROM rides
      WHERE status IN ('scheduled', 'ongoing', 'completed')
        AND source_address IS NOT NULL 
        AND destination_address IS NOT NULL
    ) AS r
    WHERE r.origin != '' AND r.destination != ''
    GROUP BY r.origin, r.destination
    ORDER BY total_trips DESC
    LIMIT ${parsedLimit}
  `;

    const [rows] = await db.execute(query);
    return rows;
  }
}

module.exports = Ride;
