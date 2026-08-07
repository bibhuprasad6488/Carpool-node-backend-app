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
