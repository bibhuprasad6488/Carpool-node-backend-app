const ActivityLog = require("../../models/admin/ActivityLog");

exports.getAllActivityLogs = async (req, res) => {
    const { page, limit, search, action } = req.query;

    const result = await ActivityLog.getAllActivityLogs({
        page: page || 1,
        limit: limit || 20,
        search: search || "",
        action: action || ""
    });

    return res.status(200).json({
        status: "success",
        data: result.logs,
        pagination: result.pagination
    });
};