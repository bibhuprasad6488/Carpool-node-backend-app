const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const userId = req.user?.id ? `user_${req.user.id}` : `temp_${Date.now()}`;
    let folderFolder = `carpool_app/documents/${userId}`;

    // Profile Pictures
    if (file.fieldname === "profile_picture") {
      folderFolder = `carpool_app/profiles/${userId}`;
    }
    
    // Vehicle Documents & Images
    const vehicleFields = [
      "rc_file", "insurance_file", "front_image", 
      "back_image", "side_image", "number_plate_image"
    ];
    if (vehicleFields.includes(file.fieldname)) {
      folderFolder = `carpool_app/vehicles/${userId}`;
    }

    const format = file.mimetype.split("/")[1] || "jpg";

    return {
      folder: folderFolder,
      format: ["jpg", "jpeg", "png", "webp", "pdf"].includes(format) ? format : "jpg",
      public_id: `${file.fieldname}_${Date.now()}`,
      resource_type: "auto",
    };
  },
});

const uploadCloudinary = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

module.exports = uploadCloudinary;