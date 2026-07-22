const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    if (!req._reqTimestamp) {
      req._reqTimestamp = Date.now();
    }

    let identifier = "";
    if (req.user?.id) {
      identifier = `user_${req.user.id}`;
    } else if (req.body?.email) {
      const cleanEmail = req.body.email.replace(/[^a-zA-Z0-9]/g, "_");
      identifier = `registration_${cleanEmail}`;
    } else {
      identifier = `temp_${req._reqTimestamp}`;
    }

    let folderFolder = `carpool_app/documents/${identifier}`;

    if (file.fieldname === "profile_picture") {
      folderFolder = `carpool_app/profiles/${identifier}`;
    }

    const vehicleFields = [
      "rc_file", "insurance_file", "front_image", 
      "back_image", "side_image", "number_plate_image"
    ];
    if (vehicleFields.includes(file.fieldname)) {
      folderFolder = `carpool_app/vehicles/${identifier}`;
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
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = uploadCloudinary;