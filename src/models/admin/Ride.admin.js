const db = require("../../config/db");

class RideManagement {
  static async getAll(travelDate = null) {
    let sql = `SELECT
    r.id,
    r.source_address,
    r.destination_address,
    r.price_per_seat,
    r.status,
    r.total_seats,
    r.available_seats,
    r.ride_date,
    r.departure_time,

    u.id AS driver_id,
    u.name AS driver_name,
    u.email AS driver_email,
    u.phone AS driver_phone,

    v.id AS vehicle_id,
    v.model,
    v.registration_number,
    v.fuel_type

FROM rides r

LEFT JOIN users u
    ON u.id = r.driver_id

LEFT JOIN vehicles v
    ON v.id = r.vehicle_id`;

    const params = [];

    if (travelDate) {
      sql += ` WHERE r.ride_date = ?`;
      params.push(travelDate);
    }
    sql += ` ORDER BY r.id DESC`;
    const [rows] = await db.execute(sql, params);
    return rows;
  }

  static async getRideByIdForAdmin(rideId) {
    const sql = `
      SELECT
        -- All Ride Table Details
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
        r.ride_date,
        r.departure_time,
        r.polyline,
        r.distance_meters,
        r.duration_seconds,
        r.estimated_reach_time,
        r.pet_allowed,
        r.smoking_allowed,
        r.instant_booking,
        r.max_two_in_back,
        r.price_per_seat,
        r.total_seats,
        r.available_seats,
        r.status,
        r.created_at,
        r.updated_at,

        -- Basic Driver Info
        u.name AS driver_name,
        u.email AS driver_email,
        u.phone AS driver_phone,


        -- Basic Vehicle Info
        v.model AS vehicle_model,
        v.registration_number AS vehicle_registration_number,
        v.fuel_type AS vehicle_fuel_type,
        v.color AS vehicle_color

      FROM rides r
      LEFT JOIN users u 
        ON u.id = r.driver_id
      LEFT JOIN vehicles v 
        ON v.id = r.vehicle_id
      WHERE r.id = ?
    `;

    const [rows] = await db.query(sql, [rideId]);

    if (!rows || rows.length === 0) {
      return null;
    }

    const ride = rows[0];

    // Safely parse JSON if route_points is stored as a JSON string in MySQL
    if (ride.route_points && typeof ride.route_points === "string") {
      try {
        ride.route_points = JSON.parse(ride.route_points);
      } catch (err) {
        console.error("Failed to parse route_points JSON:", err);
      }
    }

    return ride;
  }

  static async createRide(rideData) {
    const {
      driver_id,
      vehicle_id,
      source_address,
      source_place_id,
      destination_address,
      destination_place_id,
      source_lat,
      source_lng,
      destination_lat,
      destination_lng,
      ride_date,
      departure_time,
      polyline,
      route_points,
      distance_meters,
      duration_seconds,
      estimated_reach_time,
      pet_allowed = "no",
      smoking_allowed = "no",
      instant_booking = "no",
      max_two_in_back = "no",
      price_per_seat,
      total_seats,
      available_seats,
      status = "scheduled",
    } = rideData;

    const routePointsJson = route_points
      ? typeof route_points === "string"
        ? route_points
        : JSON.stringify(route_points)
      : null;

    const sql = `
      INSERT INTO rides (
        driver_id, vehicle_id, source_address, source_place_id,
        destination_address, destination_place_id, source_lat, source_lng,
        destination_lat, destination_lng, ride_date, departure_time,
        polyline, route_points, distance_meters, duration_seconds,
        estimated_reach_time, pet_allowed, smoking_allowed, instant_booking,
        max_two_in_back, price_per_seat, total_seats, available_seats, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      driver_id,
      vehicle_id,
      source_address,
      source_place_id,
      destination_address,
      destination_place_id,
      source_lat,
      source_lng,
      destination_lat,
      destination_lng,
      ride_date,
      departure_time,
      polyline,
      routePointsJson,
      distance_meters,
      duration_seconds,
      estimated_reach_time,
      pet_allowed,
      smoking_allowed,
      instant_booking,
      max_two_in_back,
      price_per_seat,
      total_seats,
      available_seats,
      status,
    ];

    const [result] = await db.query(sql, values);
    return result.insertId;
  }

  static async updateRide(rideId, updateFields) {
    if (!updateFields || Object.keys(updateFields).length === 0) {
      throw new Error("No fields provided for update");
    }
    if (
      updateFields.route_points &&
      typeof updateFields.route_points !== "string"
    ) {
      updateFields.route_points = JSON.stringify(updateFields.route_points);
    }

    const setClauses = [];
    const values = [];

    Object.keys(updateFields).forEach((key) => {
      setClauses.push(`${key} = ?`);
      values.push(updateFields[key]);
    });

    setClauses.push("updated_at = NOW()");

    values.push(rideId);

    const sql = `
      UPDATE rides 
      SET ${setClauses.join(", ")} 
      WHERE id = ?
    `;

    const [result] = await db.query(sql, values);
    return result.affectedRows > 0;
  }

  static async deleteRide(rideId) {
    const sql = `DELETE FROM rides WHERE id = ?`;
    const [result] = await db.query(sql, [rideId]);
    return result.affectedRows > 0;
  }

  static async getByDriverId(driverId) {
    const sql = `
      SELECT
        r.id,
        r.source_address,
        r.destination_address,
        r.price_per_seat,
        r.status,
        r.total_seats,
        r.available_seats,
        r.ride_date,
        r.departure_time,
        
        v.id AS vehicle_id,
        v.model AS vehicle_model,
        v.registration_number AS vehicle_registration_number,
        v.fuel_type AS vehicle_fuel_type
      FROM rides r
      LEFT JOIN vehicles v 
        ON v.id = r.vehicle_id
      WHERE r.driver_id = ?
      ORDER BY r.ride_date DESC, r.departure_time DESC
    `;

    const [rows] = await db.execute(sql, [driverId]);
    return rows;
  }

  static async getByPassengerId(passengerId) {
    const sql = `
      SELECT
        r.id AS ride_id,
        r.source_address,
        r.destination_address,
        r.price_per_seat,
        r.ride_date,
        r.departure_time,
        r.status AS ride_status,
        
        b.id AS booking_id,
        b.seats,
        b.status AS booking_status,
        
        u.id AS driver_id,
        u.name AS driver_name,
        u.phone AS driver_phone
      FROM ride_bookings b
      INNER JOIN rides r 
        ON r.id = b.ride_id
      LEFT JOIN users u 
        ON u.id = r.driver_id
      WHERE b.passenger_id = ?
      ORDER BY r.ride_date DESC, r.departure_time DESC
    `;

    const [rows] = await db.execute(sql, [passengerId]);
    return rows;
  }

 static async getFullRideDetailsById(rideId) {
    // 1. Fetch main Ride, Driver, and Vehicle information
    const rideQuery = `
      SELECT 
        r.id AS ride_id,
        r.status AS ride_status,
        r.created_at AS created_at,
        r.source_address,
        r.destination_address,
        r.ride_date,
        r.departure_time,
        r.estimated_reach_time,
        r.distance_meters,
        r.duration_seconds,
        r.price_per_seat,
        r.total_seats,
        r.available_seats,
        -- Driver Info
        u.id AS driver_id,
        u.name AS driver_name,
        u.phone AS driver_phone,
        u.email AS driver_email,
        ud.profile_picture AS driver_profile_picture,
        -- Vehicle Info
        v.id AS vehicle_id,
        v.brand AS vehicle_brand,
        v.model AS vehicle_model,
        v.color AS vehicle_color,
        v.vehicle_type,
        v.registration_number AS vehicle_registration_number
      FROM rides r
      INNER JOIN users u ON r.driver_id = u.id
      LEFT JOIN user_details ud ON u.id = ud.user_id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = ?
    `;

    const [rideRows] = await db.execute(rideQuery, [rideId]);
    if (!rideRows.length) return null;

    const rideData = rideRows[0];

    // 2. Fetch Passenger Bookings for this ride
    const bookingsQuery = `
      SELECT 
        b.id AS booking_id,
        b.booking_code,
        b.passenger_id,
        u.name AS passenger_name,
        u.phone AS passenger_phone,
        b.seats,
        b.ride_source AS pickup_location,
        b.ride_destination AS dropoff_location,
        b.total_price AS amount_paid,
        b.status AS booking_status,
        b.payment_status,
        b.created_at AS booked_at
      FROM ride_bookings b
      INNER JOIN users u ON b.passenger_id = u.id
      WHERE b.ride_id = ?
      ORDER BY b.created_at ASC
    `;

    const [bookings] = await db.execute(bookingsQuery, [rideId]);

    // 3. Calculate dynamic Occupancy & Total Revenue
    const bookedSeatsCount = rideData.total_seats - rideData.available_seats;
    const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.amount_paid), 0);

    // Mock Financial Breakdown (based on revenue calculations)
    const platformFeePercentage = 0.10; // 10%
    const gstRate = 0.05; // 5%
    const platformFee = totalRevenue * platformFeePercentage;
    const gstTax = totalRevenue * gstRate;
    const driverPayout = totalRevenue - platformFee;

    // 4. Construct dynamic Activity Logs using timestamps
    const activityLogs = [
      {
        title: "Ride Published",
        description: `Driver published the ride schedule.`,
        timestamp: rideData.created_at,
      },
    ];

    bookings.forEach((booking, idx) => {
      activityLogs.push({
        title: `Booking #${idx + 1} (${booking.booking_status})`,
        description: `${booking.passenger_name} booked ${booking.seats} seat(s).`,
        timestamp: booking.booked_at,
      });
    });

    if (rideData.ride_status === 'ongoing' || rideData.ride_status === 'completed') {
      activityLogs.push({
        title: "Ride Started",
        description: `Driver started the trip from ${rideData.source_address}.`,
        timestamp: `${rideData.ride_date} ${rideData.departure_time}`,
      });
    }

    if (rideData.ride_status === 'completed') {
      activityLogs.push({
        title: "Ride Completed",
        description: `Driver ended trip. Final payout queued.`,
        timestamp: rideData.updated_at,
      });
    }

    // Format metrics into screen layout contract
    return {
      header: {
        ride_code: `#RIDE-${rideData.ride_id}`,
        status: rideData.ride_status,
        created_at: rideData.created_at,
      },
      route_schedule: {
        pickup: {
          location: rideData.source_address,
          scheduled_at: `${rideData.ride_date} ${rideData.departure_time}`,
        },
        dropoff: {
          location: rideData.destination_address,
          estimated_arrival: rideData.estimated_reach_time || 'N/A',
        },
        metrics: {
          distance_km: rideData.distance_meters ? (rideData.distance_meters / 1000).toFixed(1) + ' km' : 'N/A',
          duration_mins: rideData.duration_seconds ? Math.round(rideData.duration_seconds / 60) + ' mins' : 'N/A',
          seat_price: Number(rideData.price_per_seat),
          occupancy: `${bookedSeatsCount} / ${rideData.total_seats} seats`,
        },
      },
      driver_vehicle: {
        driver: {
          id: rideData.driver_id,
          name: rideData.driver_name,
          phone: rideData.driver_phone,
          email: rideData.driver_email,
          profile_picture: rideData.driver_profile_picture,
          rating: 4.85, // Mock rating or join reviews table
          total_rides: 142, // Mock count or join count
        },
        vehicle: {
          id: rideData.vehicle_id,
          title: `${rideData.vehicle_brand} ${rideData.vehicle_model} (${rideData.vehicle_color})`,
          type: rideData.vehicle_type,
          registration_number: rideData.vehicle_registration_number,
        },
      },
      passenger_bookings: bookings.map((b) => ({
        booking_id: b.booking_id,
        passenger_name: b.passenger_name,
        passenger_phone: b.passenger_phone,
        seats: b.seats,
        pickup_location: b.pickup_location,
        dropoff_location: b.dropoff_location,
        amount_paid: Number(b.amount_paid),
        booking_status: b.booking_status,
        payment_status: b.payment_status,
      })),
      financial_breakup: {
        total_revenue: totalRevenue,
        platform_fee: platformFee,
        driver_payout: driverPayout,
        gst_tax: gstTax,
      },
      activity_logs: activityLogs,
    };
  }
}

module.exports = RideManagement;
