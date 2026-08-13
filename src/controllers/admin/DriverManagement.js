const ActivityLog = require("../../models/admin/ActivityLog");
const DriverAdminModel = require("../../models/admin/User.admin");

const ALLOWED_STATUSES = ["active", "inactive", "pending", "blocked"];

exports.getAllDrivers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || "";

    const { total, drivers } = await DriverAdminModel.getAllDrivers({
      page,
      limit,
      search,
      status,
    });

    return res.status(200).json({
      success: true,
      data: drivers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching drivers.",
    });
  }
};

exports.getPendingDrivers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const result = await DriverAdminModel.getPendingDrivers({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
    });

    return res.status(200).json({
      success: true,
      message: "Pending drivers fetched successfully",
      data: result.drivers,
      total: result.total,
    });
  } catch (error) {
    console.error("Error fetching pending drivers:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.getDriverById = async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await DriverAdminModel.getDriverById(id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found or user is not a driver.",
      });
    }

    return res.status(200).json({
      success: true,
      data: driver,
    });
  } catch (error) {
    console.error("Error fetching driver details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching driver details.",
    });
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // 1. Validate payload status
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(422).json({
        status: "error",
        message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
      });
    }

    // 2. Fetch driver & check existence
    const driver = await DriverAdminModel.findById(id);

    if (!driver) {
      return res.status(404).json({
        status: "error",
        message: "Driver not found.",
      });
    }

    // 3. Ensure role matches Driver (role === 2)
    if (Number(driver.role) !== 2) {
      return res.status(400).json({
        status: "error",
        message: "User is not registered as a driver.",
      });
    }

    // 4. Perform update
    await DriverAdminModel.updateUserStatus(id, status);

    // 5. Log activity
    await ActivityLog.create({
      user_id: req.user.id,
      action: "UPDATE_DRIVER_STATUS",
      description: `Updated Driver ID ${id} status to '${status}'`,
      entity_type: "drivers",
      entity_id: id,
      ip_address: req.ip || req.headers["x-forwarded-for"],
      user_agent: req.headers["user-agent"],
      status: "success",
    });

    return res.status(200).json({
      status: "success",
      message: `Driver status successfully updated to '${status}'.`,
    });
  } catch (error) {
    // Passes DB or execution errors to your Express error middleware
    next(error);
  }
};

exports.getDriverBriefDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await DriverAdminModel.getDriverBriefById(id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found.",
      });
    }

    // Build the documents array dynamically based on submitted fields
    const documents = [];

    if (driver.driver_license) {
      documents.push({
        id: `dl-${driver.id}`,
        type: "dl",
        title: "Driving License",
        file_url: driver.driver_license,
        status: driver.is_dl_verified || "pending",
      });
    }

    if (driver.adhhar_card) {
      documents.push({
        id: `aadhaar-${driver.id}`,
        type: "aadhaar",
        title: "Aadhaar Card",
        file_url: driver.adhhar_card,
        status: driver.is_adhhar_verified || "pending",
      });
    }

    if (driver.pan_card) {
      documents.push({
        id: `pan-${driver.id}`,
        type: "pan",
        title: "PAN Card",
        file_url: driver.pan_card,
        status: driver.is_pan_verified || "pending",
      });
    }

    // Transform and map payload to match Frontend Types
    const responsePayload = {
      id: driver.id,
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      created_at: driver.created_at,
      status: driver.driver_status || "pending",

      // Overview stats (Aggregates can be calculated or set to defaults)
      total_vehicles: 0,
      total_rides: 0,
      total_earnings: 0,

      // Nested Address Details
      address_details: driver.current_address
        ? {
            current_address: driver.current_address,
            city: driver.city || "",
            state: driver.state || "",
            pincode: driver.pincode || "",
          }
        : null,

      // Nested Bank & Payout Details
      bank_details: driver.bank_account_number
        ? {
            account_name: driver.bank_account_holder || "",
            account_number: driver.bank_account_number || "",
            bank_name: driver.bank_name || "",
            ifsc_code: driver.bank_account_ifsc || "",
          }
        : null,

      // Nested Documents Array
      documents: documents,
    };

    return res.status(200).json({
      success: true,
      data: responsePayload,
    });
  } catch (error) {
    console.error("Error in getDriverDetails:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve driver details.",
    });
  }
};
