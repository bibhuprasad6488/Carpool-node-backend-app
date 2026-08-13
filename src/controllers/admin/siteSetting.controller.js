const ActivityLog = require("../../models/admin/ActivityLog");
const SiteSetting = require("../../models/admin/siteSetting.model");

// Fetch all site settings (Admin & Public)
exports.getSettings = async (req, res) => {
  try {
    const settings = await SiteSetting.getSettings();

    // Hide sensitive SMTP password before returning
    if (settings.smtp_password) {
      delete settings.smtp_password;
    }

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve site settings",
      error: error.message,
    });
  }
};

// Update General Site Settings (Admin)
exports.updateSettings = async (req, res) => {
  try {
    const body = { ...req.body };

    // Handle file uploads if logos or favicon are sent via Multer
    if (req.files) {
      if (req.files.site_logo) body.site_logo = req.files.site_logo[0].filename;
      if (req.files.footer_logo)
        body.footer_logo = req.files.footer_logo[0].filename;
      if (req.files.footer_logo_one)
        body.footer_logo_one = req.files.footer_logo_one[0].filename;
      if (req.files.footer_logo_two)
        body.footer_logo_two = req.files.footer_logo_two[0].filename;
      if (req.files.favicon) body.favicon = req.files.favicon[0].filename;
    }

    const updatedSettings = await SiteSetting.updateSettings(body);

    return res.status(200).json({
      success: true,
      message: "Site settings updated successfully",
      data: updatedSettings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update site settings",
      error: error.message,
    });
  }
};

// Get Platform Commission
exports.getCommission = async (req, res) => {
  try {
    const commission = await SiteSetting.getCommission();
    return res.status(200).json({
      success: true,
      commission: commission || "0",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve commission",
      error: error.message,
    });
  }
};

// Update Platform Commission (Admin)
exports.updateCommission = async (req, res) => {
  try {
    const { commision } = req.body;

    if (commision === undefined || commision === null) {
      return res.status(400).json({
        success: false,
        message: "Commission value is required",
      });
    }

    await SiteSetting.updateCommission(commision);

    await ActivityLog.create({
      user_id: req.user.id,
      action: "PLATFORM SETTINGS UPDATED",
      description: "Platform fee updated",
      entity_type: "pltform",
      entity_id: 0,
      ip_address: req.ip || req.headers["x-forwarded-for"],
      user_agent: req.headers["user-agent"],
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message: "Platform commission updated successfully",
      commission: commision,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update commission",
      error: error.message,
    });
  }
};
