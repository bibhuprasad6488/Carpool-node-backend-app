const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // 1. Get User ID safely (from authenticated req.user or generate a temporary timestamp marker)
    const identifier = req.user?.id ? `user_${req.user.id}` : `temp_${Date.now()}`;

    // 2. Determine folder structure dynamically
    let folderFolder = `carpool_app/documents/${identifier}`;
    if (file.fieldname === "profile_picture") {
      folderFolder = `carpool_app/profiles/${identifier}`;
    }

    // 3. Clean format extension check
    const format = file.mimetype.split("/")[1] || "jpg";

    return {
      folder: folderFolder,
      format: ["jpg", "jpeg", "png", "webp", "pdf"].includes(format) ? format : "jpg",
      public_id: `${file.fieldname}_${Date.now()}`,
      resource_type: "auto", // Supports images AND PDFs seamlessly
    };
  },
});

const uploadCloudinary = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

module.exports = uploadCloudinary;