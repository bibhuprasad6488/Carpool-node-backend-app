const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const userId = req.user?.id || "guest";
    let folderPath = `carpool_app/users/user_${userId}/documents`;

    if (file.fieldname === "profile_picture") {
      folderPath = `carpool_app/users/user_${userId}/profile`;
    }

    return {
      folder: folderPath,
      allowed_formats: ["jpg", "jpeg", "png", "webp", "pdf"],
      public_id: `${file.fieldname}_${Date.now()}`, // Clean filename
    };
  },
});

const upload = multer({ storage });

module.exports = upload;
