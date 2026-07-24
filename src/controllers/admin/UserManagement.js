const User = require("../../models/User");


// Helper to safely format image URLs without throwing exceptions
const safeFormatUrl = (url) => {
  if (!url) return null;
  try {
    return formatUrl ? formatUrl(url) : url;
  } catch (err) {
    return url;
  }
};

// GET /api/v1/admin/users
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search || "";
    const role = req.query.role || "all";
    const status = req.query.status || "all";

    // Safely execute stats and list queries in parallel
    const [stats, users] = await Promise.all([
      User.getUserStats(),
      User.getAdminUsersList({ search, role, status, limit, offset }),
    ]);

    const formattedUsers = (users || []).map((u) => {
      let verificationStatus = "Pending";
      if (u.status === "suspended") {
        verificationStatus = "Suspended";
      } else if (Number(u.is_verified) === 1) {
        verificationStatus = "Verified";
      }

      // Map role integer values with fallbacks
      let roleLabel = "Rider";
      if (Number(u.role) === 1) roleLabel = "Admin";
      else if (Number(u.role) === 2) roleLabel = "Driver";
      else if (Number(u.role) === 3) roleLabel = "Rider";

      return {
        id: u.id,
        custom_id: `USR-${u.id}`,
        name: u.name || "N/A",
        email: u.email || "N/A",
        role: roleLabel,
        verification_status: verificationStatus,
        trips: Number(u.trips) || 0,
        rating: Number(u.rating) > 0 ? Number(u.rating).toFixed(1) : "N/A",
        created_at: u.created_at || new Date().toISOString(),
      };
    });

    return res.status(200).json({
      status: "success",
      data: {
        stats: stats || { totalUsers: 0, verifiedAccounts: 0, pendingApproval: 0, suspendedUsers: 0 },
        users: formattedUsers,
      },
    });
  } catch (error) {
    console.error("Error fetching admin users list:", error);
    return res.status(500).json({
      status: "error",
      message: "An internal error occurred while fetching users.",
    });
  }
};

// GET /api/v1/admin/users/:id
exports.getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.getFullUserDetails(id);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    // Role mapping fallback
    let roleLabel = "Rider";
    if (Number(user.role) === 1) roleLabel = "Admin";
    else if (Number(user.role) === 2) roleLabel = "Driver";
    else if (Number(user.role) === 3) roleLabel = "Rider";

    // Status calculation fallback
    let verificationStatus = "Pending";
    if (user.status === "suspended") {
      verificationStatus = "Suspended";
    } else if (Number(user.is_verified) === 1) {
      verificationStatus = "Verified";
    }

    return res.status(200).json({
      status: "success",
      data: {
        user: {
          id: user.id,
          custom_id: `USR-${user.id}`,
          name: user.name || "N/A",
          email: user.email || "N/A",
          phone: user.phone || "N/A",
          role: roleLabel,
          status: user.status || "active",
          verification_status: verificationStatus,
          created_at: user.created_at || new Date().toISOString(),
          profile_picture: safeFormatUrl(user.profile_picture),
          user_details: {
            city: user.city || "N/A",
            state: user.state || "N/A",
            country: user.country || "N/A",
            address: user.address || "N/A",
            postal_code: user.postal_code || "N/A",
            driver_license: safeFormatUrl(user.driver_license),
            is_dl_verified: user.is_dl_verified ?? "0",
            adhhar_card: safeFormatUrl(user.adhhar_card),
            is_adhhar_verified: user.is_adhhar_verified ?? "0",
            pan_card: safeFormatUrl(user.pan_card),
            is_pan_verified: user.is_pan_verified ?? "0",
            bank_account: safeFormatUrl(user.bank_account),
            bank_account_holder: user.bank_account_holder || "N/A",
            bank_account_number: user.bank_account_number || "N/A",
            bank_name: user.bank_name || "N/A",
            bank_account_ifsc: user.bank_account_ifsc || "N/A",
            is_account_verified: user.is_account_verified ?? "0",
          },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching single user details:", error);
    return res.status(500).json({
      status: "error",
      message: "An internal error occurred while fetching user details.",
    });
  }
};