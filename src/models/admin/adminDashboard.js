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
    recentActivitiesRes
  ] = await Promise.all([
    
    // 1. Active Live Rides
    db.query(`SELECT COUNT(*) AS total FROM rides WHERE status = 'scheduled'`),

    // 2. Total Trips Today
    db.query(`SELECT COUNT(*) AS total FROM ride_bookings WHERE created_at >= CURDATE()`),

    // 3. Pending Approvals
    db.query(`SELECT COUNT(*) AS total FROM user_details WHERE status = 'pending'`),

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
    `)
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
    const dateStr = new Date(row.formatted_date).toISOString().split('T')[0];
    demandMap.set(dateStr, Number(row.volume));
  });

  const liveRideDemand = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    
    const dateKey = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }); // e.g. "Mon (Aug 03)"

    liveRideDemand.push({
      day: `${dayLabel.split(',')[0]} (${dayLabel.split(' ')[0]} ${dayLabel.split(' ')[1]})`, // e.g. "Mon (Aug 03)"
      date: dateKey,
      volume: demandMap.get(dateKey) || 0 // Default to 0 if no rides recorded
    });
  }

  // --- FIX 2: Map Activity Logs with Valid Timestamp ---
  const recentActivities = recentActivitiesRes[0].map((activity) => ({
    id: activity.id,
    type: activity.type,
    action: activity.action,
    description: activity.description,
    timestamp: activity.created_at ? new Date(activity.created_at).toISOString() : new Date().toISOString()
  }));

  return {
    metrics: {
      active_live_rides: {
        value: activeRidesCount,
        percentage_change: 12.5,
        comparison_period: 'from yesterday'
      },
      total_trips_today: {
        value: todayTripsCount,
        percentage_change: 8.2,
        comparison_period: 'vs last week'
      },
      pending_approvals: {
        value: pendingApprovalsCount,
        status_label: 'Requires immediate review'
      },
      platform_revenue: {
        value: Number(totalRevenue.toFixed(2)),
        currency: 'INR',
        last_updated: new Date().toISOString()
      }
    },
    live_ride_demand: liveRideDemand,
    recent_activities: recentActivities
  };
};



exports.getAnalyticsData = async function (query = {}) {
  const timeframe = query.timeframe || '7D';
  const comparison = query.comparison || 'vs_previous';

  return {
    overview: {
      timeframe,
      comparison,
      title: "Platform Performance",
      subtitle: "Comparative insights across user growth, ride conversions, seat occupancy, and revenue streams.",
      last_updated: new Date().toISOString()
    },

    // Top Row - KPI Cards
    kpis: {
      total_revenue: {
        label: "TOTAL REVENUE",
        value: 38420,
        currency: "USD",
        formatted_value: "$38,420",
        percentage_change: 14.2,
        is_positive: true,
        comparison_label: "vs prior period"
      },
      rides_conversion_rate: {
        label: "RIDES CONVERSION RATE",
        value: 81.4,
        unit: "%",
        formatted_value: "81.4%",
        percentage_change: 3.8,
        is_positive: true,
        sub_text: "12.4k booked / 15.3k published"
      },
      active_platform_users: {
        label: "ACTIVE PLATFORM USERS",
        value: 24910,
        formatted_value: "24,910",
        percentage_change: 8.5,
        is_positive: true,
        breakdown: {
          riders: "19.2k",
          drivers: "5.7k"
        }
      },
      avg_occupancy_rate: {
        label: "AVG OCCUPANCY RATE",
        value: 3.2,
        max_capacity: 4,
        formatted_value: "3.2 / 4",
        change_value: -0.1,
        is_positive: false,
        change_unit: "seats",
        target_text: "Target: 3.5 seats per car"
      }
    },

    // Middle Left Chart - Revenue & Ride Booking Velocity
    booking_velocity: {
      title: "Revenue & Ride Booking Velocity",
      description: "Comparison of total rides offered versus actual passenger seat conversions",
      average_fill_yield: 81.2,
      chart_data: [
        { day: "Mon", prior_period_target: 2000, rides_booked: 1800, rides_published: 2100 },
        { day: "Tue", prior_period_target: 2200, rides_booked: 2050, rides_published: 2400 },
        { day: "Wed", prior_period_target: 1900, rides_booked: 1850, rides_published: 2250 },
        { day: "Thu", prior_period_target: 2350, rides_booked: 2300, rides_published: 2850 },
        { day: "Fri", prior_period_target: 2950, rides_booked: 2800, rides_published: 3350 },
        { day: "Sat", prior_period_target: 1400, rides_booked: 1300, rides_published: 1900 },
        { day: "Sun", prior_period_target: 1100, rides_booked: 1050, rides_published: 1500 }
      ]
    },

    // Middle Right Chart - Ride Capacity Breakdown
    capacity_breakdown: {
      title: "Ride Capacity Breakdown",
      description: "Occupancy rates per published ride departure",
      total_rides: 15300,
      formatted_total_rides: "15.3k",
      segments: [
        {
          key: "full",
          label: "Full (3-4 Passengers)",
          percentage: 50.0,
          count: 7665,
          formatted_count: "7,665",
          color: "#3B82F6"
        },
        {
          key: "partial",
          label: "Partial (1-2 Passengers)",
          percentage: 25.0,
          count: 3832,
          formatted_count: "3,832",
          color: "#10B981"
        },
        {
          key: "solo",
          label: "Solo (Driver Only)",
          percentage: 16.6,
          count: 2545,
          formatted_count: "2,545",
          color: "#F59E0B"
        },
        {
          key: "cancelled",
          label: "Cancelled Rides",
          percentage: 8.4,
          count: 1288,
          formatted_count: "1,288",
          color: "#EF4444"
        }
      ]
    }
  };
};