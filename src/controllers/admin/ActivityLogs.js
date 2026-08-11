const ActivityLog = require("../../models/admin/ActivityLog");

exports.getAllActivityLogs = async (req, res) => {
  try {
    const { page, limit, search, action } = req.query;

    const result = await ActivityLog.getAllActivityLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search: search || "",
      action: action || "",
    });

    return res.status(200).json({
      status: "success",
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch activity logs",
    });
  }
};

exports.getActivityLogById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: "fail",
        message: "Activity log ID is required",
      });
    }

    const log = await ActivityLog.getLogById(id);

    if (!log) {
      return res.status(404).json({
        status: "fail",
        message: `Activity log with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      status: "success",
      data: log,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch activity log",
    });
  }
};

exports.clearAllActivityLogs = async (req, res) => {
  try {
    await ActivityLog.clearAllLogs();

    return res.status(200).json({
      status: "success",
      message: "All activity logs have been cleared successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to clear activity logs",
    });
  }
};