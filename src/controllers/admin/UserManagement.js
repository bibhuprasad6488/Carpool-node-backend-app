const UserManagement = require("../../models/admin/User.admin");
const APP_URL = process.env.APP_URL;

const formatUrl = (filePath) => {
    if (!filePath) return "";
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
        return filePath;
    }
    return `${APP_URL}/uploads/user/${filePath}`;
};

exports.getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const offset = (page - 1) * limit;

    const search = req.query.search || "";
    const role = req.query.role || "all";
    const status = req.query.status || "all";

    // Execute stats and user list queries in parallel
    const [stats, users] = await Promise.all([
      UserManagement.getUserStats(),
      UserManagement.getAdminUsersList({ search, role, status, limit, offset }),
    ]);

    const formattedUsers = (users || []).map((u) => {
      let verificationStatus = "Pending";
      if (u.status === "suspended") {
        verificationStatus = "Suspended";
      } else if (Number(u.is_verified) === 1) {
        verificationStatus = "Verified";
      }

      // Role mapping (Handles string and integer roles)
      let roleLabel = "Passenger";
      const rawRole = String(u.role).toLowerCase();

      if (rawRole === "1" || rawRole === "admin") {
        roleLabel = "Admin";
      } else if (rawRole === "2" || rawRole === "driver") {
        roleLabel = "Driver";
      } else if (rawRole === "3" || rawRole === "passenger") {
        roleLabel = "Passenger";
      } else if (u.role) {
        // Capitalize default fallback role string
        roleLabel = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
      }

      return {
        id: u.id,
        custom_id: `USR-${u.id}`,
        name: u.name || "N/A",
        email: u.email || "N/A",
        phone: u.phone || "N/A",
        role: roleLabel,
        status: u.status || "active",
        verification_status: verificationStatus,
        kyc_status: u.kyc_status || "pending",
        profile_picture: formatUrl(u.profile_picture),
        location:
          u.city && u.state
            ? `${u.city}, ${u.state}`
            : u.city || u.state || "N/A",
        created_at: u.created_at || new Date().toISOString(),
      };
    });

    return res.status(200).json({
      status: "success",
      data: {
        stats: stats || {
          totalUsers: 0,
          verifiedAccounts: 0,
          pendingApproval: 0,
          suspendedUsers: 0,
        },
        users: formattedUsers,
        pagination: {
          page,
          limit,
        },
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

exports.getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserManagement.getFullUserDetails(id);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    // Role mapping fallback
    let roleLabel = "Passenger";
    const rawRole = String(user.role).toLowerCase();

    if (rawRole === "1" || rawRole === "admin") {
      roleLabel = "Admin";
    } else if (rawRole === "2" || rawRole === "driver") {
      roleLabel = "Driver";
    } else if (rawRole === "3" || rawRole === "Passenger") {
      roleLabel = "Passenger";
    } else if (user.role) {
      roleLabel = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
    }

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
          updated_at: user.updated_at || null,
          profile_picture: formatUrl(user.profile_picture),
          user_details: {
            city: user.city || "N/A",
            state: user.state || "N/A",
            country: user.country || "N/A",
            address: user.address || "N/A",
            postal_code: user.postal_code || "N/A",
            driver_license: formatUrl(user.driver_license),
            is_dl_verified: user.is_dl_verified || "pending",
            adhhar_card: formatUrl(user.adhhar_card),
            is_adhhar_verified: user.is_adhhar_verified || "pending",
            pan_card: formatUrl(user.pan_card),
            is_pan_verified: user.is_pan_verified || "pending",
            bank_account: formatUrl(user.bank_account),
            bank_account_holder: user.bank_account_holder || "N/A",
            bank_account_number: user.bank_account_number || "N/A",
            bank_name: user.bank_name || "N/A",
            bank_account_ifsc: user.bank_account_ifsc || "N/A",
            is_account_verified: user.is_account_verified || "pending",
            details_status: user.details_status || "pending",
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

exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status value. Allowed values are 'active' or 'inactive'.",
      });
    }

    // Check if user exists
    const user = await UserManagement.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Update status
    await UserManagement.updateUserStatus(id, status);

    return res.status(200).json({
      success: true,
      message: `User status successfully updated to ${status}.`,
      data: { userId: id, status },
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating user status.",
    });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const status = "blocked";

    // Check if user exists
    const user = await UserManagement.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Optional Guard: Check if user is already blocked
    if (user.status === status) {
      return res.status(400).json({
        success: false,
        message: "User is already blocked.",
      });
    }

    // Update status to blocked
    await UserManagement.updateUserStatus(id, status);

    return res.status(200).json({
      success: true,
      message: "User account has been successfully blocked.",
      data: { userId: id, status },
    });
  } catch (error) {
    console.error("Error blocking user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while blocking user.",
    });
  }
};

exports.verifyDocument = async (req, res) => {
  try {
    const { userId } = req.params;
    const { docType, status } = req.body; // docType: 'license' | 'aadhar' | 'pan' | 'bank'

    const validStatuses = ["pending", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value." });
    }

    await UserManagement.updateDocumentStatus(userId, docType, status);

    return res.status(200).json({
      success: true,
      message: `Document ${docType} updated to ${status} successfully.`,
    });
  } catch (error) {
    console.error("Error updating document status:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

exports.updateDriverStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // status: 'active' | 'blocked' | 'rejected'

    if (status === "active") {
      const details = await UserManagement.getVerificationState(userId);

      if (!details) {
        return res
          .status(404)
          .json({ success: false, message: "Driver details not found." });
      }

      const allDocsApproved =
        details.is_dl_verified === "approved" &&
        details.is_adhhar_verified === "approved" &&
        details.is_pan_verified === "approved" &&
        details.is_account_verified === "approved";

      if (!allDocsApproved) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot approve driver until all required documents are verified as approved.",
        });
      }

      await UserManagement.updateDriverOverallStatus(userId, {
        status: "active",
        isVerified: "1",
      });

      await UserManagement.updateUserStatus(userId, status);

      return res.status(200).json({
        success: true,
        message: "Driver approved and activated successfully.",
      });
    }

    if (status === "blocked" || status === "rejected") {
      await UserManagement.updateDriverOverallStatus(userId, {
        status: "rejected",
        isVerified: "0",
      });
      await UserManagement.updateUserStatus(userId, status);

      return res.status(200).json({
        success: true,
        message: "Driver application rejected successfully.",
      });
    }

    return res
      .status(400)
      .json({ success: false, message: "Invalid driver status provided." });
  } catch (error) {
    console.error("Error updating driver status:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};
