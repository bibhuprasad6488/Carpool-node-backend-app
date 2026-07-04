const multer = require("multer");
const fs = require("fs");
const path = require("path");

const upload = (folder) => {

    const uploadPath = path.join(__dirname, `../public/uploads/${folder}`);

    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    const storage = multer.diskStorage({

        destination(req, file, cb) {
            cb(null, uploadPath);
        },

        filename(req, file, cb) {

            const ext = path.extname(file.originalname);

            const filename =
                Date.now() +
                "_" +
                Math.floor(Math.random() * 100000) +
                ext;

            cb(null, filename);
        }

    });

    return multer({ storage });

};

module.exports = upload;