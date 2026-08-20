// services/adminDashboard.service.js
const db = require("../../config/db");

exports.getBootstrapData = async () => {
  // Execute queries concurrently
  const [
    activeRidesRes,
    todayTripsRes,
    pendingApprovalsRes,
    revenueRes,
    demandTrendRes,
    recentActivitiesRes,
  ] = await Promise.all([
    // 1. Active Live Rides
    db.query(`SELECT COUNT(*) AS total FROM rides WHERE status = 'scheduled'`),

    // 2. Total Trips Today
    db.query(
      `SELECT COUNT(*) AS total FROM ride_bookings WHERE created_at >= CURDATE()`,
    ),

    // 3. Pending Approvals
    db.query(
      `SELECT COUNT(*) AS total FROM user_details WHERE status = 'pending'`,
    ),

    // 4. Platform Revenue Today
    db.query(`
      SELECT COALESCE(SUM(amount * 0.20), 0) AS total_revenue 
      FROM payments 
      WHERE payment_status IN ('paid', 'completed', 'success') 
        AND created_at >= CURDATE()
    `),

    // 5. Day-wise Ride Demand (Raw query for last 7 days)
    db.query(`
      SELECT 
        DATE(created_at) AS formatted_date,
        COUNT(*) AS volume
      FROM rides
      WHERE created_at >= CURDATE() - INTERVAL 6 DAY
      GROUP BY DATE(created_at)
    `),

    // 6. Recent Activities Feed
    db.query(`
      SELECT 
        id, 
        entity_type AS type, 
        action, 
        description, 
        created_at
      FROM activity_logs
      ORDER BY id DESC
      LIMIT 10
    `),
  ]);

  // Extract raw query counts safely
  const activeRidesCount = Number(activeRidesRes[0][0]?.total) || 0;
  const todayTripsCount = Number(todayTripsRes[0][0]?.total) || 0;
  const pendingApprovalsCount = Number(pendingApprovalsRes[0][0]?.total) || 0;
  const totalRevenue = Number(revenueRes[0][0]?.total_revenue) || 0;

  // --- FIX 1: Generate Full 7-Day Continuous Array (Fills missing dates with volume = 0) ---
  const demandMap = new Map();
  demandTrendRes[0].forEach((row) => {
    // Format YYYY-MM-DD from DB row
    const dateStr = new Date(row.formatted_date).toISOString().split("T")[0];
    demandMap.set(dateStr, Number(row.volume));
  });

  const liveRideDemand = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);

    const dateKey = d.toISOString().split("T")[0];
    const dayLabel = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "2-digit",
    }); // e.g. "Mon (Aug 03)"

    liveRideDemand.push({
      day: `${dayLabel.split(",")[0]} (${dayLabel.split(" ")[0]} ${dayLabel.split(" ")[1]})`, // e.g. "Mon (Aug 03)"
      date: dateKey,
      volume: demandMap.get(dateKey) || 0, // Default to 0 if no rides recorded
    });
  }

  // --- FIX 2: Map Activity Logs with Valid Timestamp ---
  const recentActivities = recentActivitiesRes[0].map((activity) => ({
    id: activity.id,
    type: activity.type,
    action: activity.action,
    description: activity.description,
    timestamp: activity.created_at
      ? new Date(activity.created_at).toISOString()
      : new Date().toISOString(),
  }));

  return {
    metrics: {
      active_live_rides: {
        value: activeRidesCount,
        percentage_change: 12.5,
        comparison_period: "from yesterday",
      },
      total_trips_today: {
        value: todayTripsCount,
        percentage_change: 8.2,
        comparison_period: "vs last week",
      },
      pending_approvals: {
        value: pendingApprovalsCount,
        status_label: "Requires immediate review",
      },
      platform_revenue: {
        value: Number(totalRevenue.toFixed(2)),
        currency: "INR",
        last_updated: new Date().toISOString(),
      },
    },
    live_ride_demand: liveRideDemand,
    recent_activities: recentActivities,
  };
};

exports.getAnalyticsData = async function (query = {}) {
  const timeframe = query.timeframe || "7D";
  const comparison = query.comparison || "vs_previous";

  // 1. Fetch KPI Aggregates for the last 7 days
  // 1. Fetch Lifetime KPI Aggregates
  const [kpiRows] = await db.execute(`
    SELECT
      -- Lifetime Total Revenue
      COALESCE(SUM(CASE WHEN rb.payment_status = 'paid' OR rb.status = 'confirmed' THEN rb.total_price ELSE 0 END), 0) AS total_revenue,
      
      -- Lifetime Rides & Conversion
      COUNT(DISTINCT r.id) AS total_published_rides,
      COUNT(DISTINCT CASE WHEN rb.status IN ('confirmed', 'completed') THEN r.id END) AS converted_rides,
      COALESCE(SUM(CASE WHEN rb.status IN ('confirmed', 'completed') THEN rb.seats ELSE 0 END), 0) AS total_seats_booked,

      -- Lifetime Average Occupancy
      COALESCE(AVG(r.total_seats - r.available_seats), 0) AS avg_occupancy
    FROM rides r
    LEFT JOIN ride_bookings rb ON r.id = rb.ride_id
  `);

  const kpi = kpiRows[0];

  // 2. Fetch Lifetime Active Platform Users Breakdown (Riders vs Drivers)
  const [userRows] = await db.execute(`
    SELECT 
      COUNT(DISTINCT CASE WHEN u.role = '3' THEN u.id END) AS active_riders,
      COUNT(DISTINCT CASE WHEN u.role = '2' THEN u.id END) AS active_drivers
    FROM users u
    LEFT JOIN ride_bookings rb ON u.id = rb.passenger_id
    LEFT JOIN rides r ON u.id = r.driver_id
    WHERE rb.id IS NOT NULL OR r.id IS NOT NULL OR u.role IN ('2', '3')
  `);

  const activeRiders = Number(userRows[0].active_riders || 0);
  const activeDrivers = Number(userRows[0].active_drivers || 0);
  const totalActiveUsers = activeRiders + activeDrivers;

  // Calculate Conversion %
  const totalPublished = Number(kpi.total_published_rides || 0);
  const totalConverted = Number(kpi.converted_rides || 0);
  const conversionRate =
    totalPublished > 0
      ? ((totalConverted / totalPublished) * 100).toFixed(1)
      : "0.0";

  // 3. Middle Left Chart: Booking Velocity (Guarantees all 7 days are present)
  const [velocityRows] = await db.execute(`
    WITH RECURSIVE last_7_days AS (
      SELECT DATE(NOW() - INTERVAL 6 DAY) AS date_val
      UNION ALL
      SELECT date_val + INTERVAL 1 DAY
      FROM last_7_days
      WHERE date_val < DATE(NOW())
    )
    SELECT 
      DATE_FORMAT(d.date_val, '%a') AS day,
      COALESCE(COUNT(DISTINCT r.id), 0) AS rides_published,
      COALESCE(SUM(CASE WHEN rb.status IN ('confirmed', 'completed') THEN rb.seats ELSE 0 END), 0) AS rides_booked
    FROM last_7_days d
    LEFT JOIN rides r ON DATE(r.created_at) = d.date_val
    LEFT JOIN ride_bookings rb ON DATE(rb.created_at) = d.date_val
    GROUP BY d.date_val
    ORDER BY d.date_val ASC
  `);

  // 4. Middle Right Chart: Capacity Breakdown
  const [capacityRows] = await db.execute(`
    SELECT
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_count,
      COUNT(CASE WHEN status != 'cancelled' AND (total_seats - available_seats) >= 3 THEN 1 END) AS full_count,
      COUNT(CASE WHEN status != 'cancelled' AND (total_seats - available_seats) BETWEEN 1 AND 2 THEN 1 END) AS partial_count,
      COUNT(CASE WHEN status != 'cancelled' AND (total_seats - available_seats) = 0 THEN 1 END) AS solo_count,
      COUNT(*) AS total_count
    FROM rides
    WHERE created_at >= NOW() - INTERVAL 7 DAY
  `);

  const cap = capacityRows[0];
  const totalCapacityRides = Number(cap.total_count || 1); // avoid divide-by-zero

  const getPercent = (count) =>
    Number(((count / totalCapacityRides) * 100).toFixed(1));

  // Construct standard output response
  return {
    overview: {
      timeframe,
      comparison,
      title: "Platform Performance",
      subtitle:
        "Comparative insights across user growth, ride conversions, seat occupancy, and revenue streams",
      last_updated: new Date().toISOString(),
    },

    kpis: {
      total_revenue: {
        label: "TOTAL REVENUE",
        value: Number(kpi.total_revenue),
        currency: "INR",
        formatted_value: `₹${Number(kpi.total_revenue).toLocaleString("en-IN")}`,
        percentage_change: 0.0, // Can be connected to a comparison query if needed
        is_positive: true,
        comparison_label: "vs prior 7 days",
      },
      rides_conversion_rate: {
        label: "RIDES CONVERSION RATE",
        value: Number(conversionRate),
        unit: "%",
        formatted_value: `${conversionRate}%`,
        percentage_change: 0.0,
        is_positive: true,
        sub_text: `${totalConverted} booked / ${totalPublished} published`,
      },
      active_platform_users: {
        label: "ACTIVE PLATFORM USERS",
        value: totalActiveUsers,
        formatted_value: totalActiveUsers.toLocaleString("en-IN"),
        percentage_change: 0.0,
        is_positive: true,
        breakdown: {
          riders:
            activeRiders > 1000
              ? `${(activeRiders / 1000).toFixed(1)}k`
              : `${activeRiders}`,
          drivers:
            activeDrivers > 1000
              ? `${(activeDrivers / 1000).toFixed(1)}k`
              : `${activeDrivers}`,
        },
      },
      avg_occupancy_rate: {
        label: "AVG OCCUPANCY RATE",
        value: Number(Number(kpi.avg_occupancy).toFixed(1)),
        max_capacity: 4,
        formatted_value: `${Number(kpi.avg_occupancy).toFixed(1)} / 4`,
        change_value: 0.0,
        is_positive: true,
        change_unit: "seats",
        target_text: "Target: 3.5 seats per car",
      },
    },

    booking_velocity: {
      title: "Revenue & Ride Booking Velocity",
      description:
        "Comparison of total rides offered versus actual passenger seat conversions over the last 7 days",
      average_fill_yield: Number(conversionRate),
      chart_data: velocityRows.map((row) => ({
        day: row.day,
        prior_period_target: Math.round(Number(row.rides_published) * 0.85), // Estimated target baseline
        rides_booked: Number(row.rides_booked),
        rides_published: Number(row.rides_published),
      })),
    },

    capacity_breakdown: {
      title: "Ride Capacity Breakdown",
      description: "Occupancy rates per published ride departure",
      total_rides: Number(cap.total_count),
      formatted_total_rides:
        cap.total_count > 1000
          ? `${(cap.total_count / 1000).toFixed(1)}k`
          : `${cap.total_count}`,
      segments: [
        {
          key: "full",
          label: "Full (3-4 Passengers)",
          percentage: getPercent(cap.full_count),
          count: Number(cap.full_count),
          formatted_count: Number(cap.full_count).toLocaleString("en-IN"),
          color: "#3B82F6",
        },
        {
          key: "partial",
          label: "Partial (1-2 Passengers)",
          percentage: getPercent(cap.partial_count),
          count: Number(cap.partial_count),
          formatted_count: Number(cap.partial_count).toLocaleString("en-IN"),
          color: "#10B981",
        },
        {
          key: "solo",
          label: "Solo (Driver Only)",
          percentage: getPercent(cap.solo_count),
          count: Number(cap.solo_count),
          formatted_count: Number(cap.solo_count).toLocaleString("en-IN"),
          color: "#F59E0B",
        },
        {
          key: "cancelled",
          label: "Cancelled Rides",
          percentage: getPercent(cap.cancelled_count),
          count: Number(cap.cancelled_count),
          formatted_count: Number(cap.cancelled_count).toLocaleString("en-IN"),
          color: "#EF4444",
        },
      ],
    },
  };
};

exports.getGrowthAndCorridorsData = async function () {
  const [userGrowthRows] = await db.execute(`
    SELECT 
      COUNT(CASE WHEN role = '3' AND created_at >= NOW() - INTERVAL 30 DAY THEN 1 END) AS new_riders_30d,
      COUNT(CASE WHEN role = '2' AND created_at >= NOW() - INTERVAL 30 DAY THEN 1 END) AS new_drivers_30d,
      COUNT(CASE WHEN role = '3' THEN 1 END) AS total_riders,
      COUNT(CASE WHEN role = '2' THEN 1 END) AS total_drivers
    FROM users
  `);

  const ug = userGrowthRows[0];
  const newRiders = Number(ug.new_riders_30d || 0);
  const newDrivers = Number(ug.new_drivers_30d || 0);
  const totalNewUsers = newRiders + newDrivers;

  // Calculate percentage splits safely
  const riderPercentage =
    totalNewUsers > 0 ? Math.round((newRiders / totalNewUsers) * 100) : 50;
  const driverPercentage =
    totalNewUsers > 0 ? Math.round((newDrivers / totalNewUsers) * 100) : 50;

  // Build dynamic insight message
  let aiInsight =
    "Driver and passenger onboarding are well-balanced across the platform.";
  if (riderPercentage >= 65) {
    aiInsight = `Passenger demand is growing rapidly (${riderPercentage}% of new users). Consider launching a driver recruitment campaign to maintain route supply.`;
  } else if (driverPercentage >= 50) {
    aiInsight = `Driver onboarding (${driverPercentage}%) is outpacing passenger growth. Run rider promotion campaigns to boost seat occupancy.`;
  }

  // 2. Top Performing Corridors (Grouped by Source & Destination)
  const [corridorRows] = await db.execute(`
    SELECT 
      CONCAT(
        SUBSTRING_INDEX(source_address, ',', 1), 
        ' ➔ ', 
        SUBSTRING_INDEX(destination_address, ',', 1)
      ) AS route,
      COUNT(id) AS total_trips,
      COALESCE(AVG(price_per_seat), 0) AS avg_fare
    FROM rides
    WHERE status IN ('scheduled', 'ongoing', 'completed')
    GROUP BY source_address, destination_address
    ORDER BY total_trips DESC
    LIMIT 5
  `);

  const topCorridors = corridorRows.map((row) => ({
    route: row.route,
    volume: `${Number(row.total_trips).toLocaleString("en-IN")} trips`,
    fare: `₹${Number(row.avg_fare).toFixed(2)}`,
    growth: "+10%", // Static placeholder or calculated via 30d comparison
  }));

  return {
    user_acquisition: {
      total_new: `+${totalNewUsers.toLocaleString("en-IN")} New`,
      riders: {
        count: newRiders.toLocaleString("en-IN"),
        percentage: riderPercentage,
        label: `${newRiders.toLocaleString("en-IN")} riders (${riderPercentage}%)`,
      },
      drivers: {
        count: newDrivers.toLocaleString("en-IN"),
        percentage: driverPercentage,
        label: `${newDrivers.toLocaleString("en-IN")} drivers (${driverPercentage}%)`,
      },
      ai_insight: aiInsight,
    },
    top_corridors: topCorridors,
  };
};
