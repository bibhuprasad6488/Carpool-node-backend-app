
const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const Vehicle = require("../models/Vehicle");

exports.index = async (req, res) => {
    try {

        const userId = req.user.id;

        if (!userId) {
            return res.json([]);
        }

        const vehicles = await Vehicle.getByUserId(userId);

        const response = vehicles.map(formatVehicleDetails);

        return res.json(response);

    } catch (err) {

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    }
};

exports.allVehicleLists = async (req, res) => {
    try {

        const userId = req.user.id;

        if (!userId) {
            return res.json([]);
        }

        const vehicles = await Vehicle.getByUserId(userId);

        const response = vehicles.map(function (vehicle) {
            return {
                id: vehicle.id,
                user_id: vehicle.user_id,
                vehicle_type: vehicle.vehicle_type,
                brand: vehicle.brand,
                model: vehicle.model,
                registration_number: vehicle.registration_number,

            };
        });

        return res.json(response);

    } catch (err) {

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    }
};

exports.store = async (req, res) => {
  const {
    brand,
    model,
    manufacture_year,
    registration_number,
    color,
    seats,
    available_seats,
    fuel_type,
    rc_number,
    rc_expiry_date,
    insurance_provider,
    policy_number,
    insurance_expiry,
    vehicle_type
  } = req.body;

  // Securely get user_id from auth middleware
  const user_id = req.user.id;

  // Custom Validations
  if (!brand) return res.status(422).json({ status: "error", message: "Brand is required" });
  if (!model) return res.status(422).json({ status: "error", message: "Model is required" });
  if (!manufacture_year) return res.status(422).json({ status: "error", message: "Manufacture year is required" });
  if (!registration_number) return res.status(422).json({ status: "error", message: "Registration number is required" });
  if (!color) return res.status(422).json({ status: "error", message: "Color is required" });
  if (!seats) return res.status(422).json({ status: "error", message: "Seats are required" });
  if (!fuel_type) return res.status(422).json({ status: "error", message: "Fuel type is required" });
  if (!rc_number) return res.status(422).json({ status: "error", message: "RC Number is required" });

  // Extract Cloudinary HTTPS URLs directly using .path
  const rc_file = req.files?.rc_file?.[0]?.path || null;
  const insurance_file = req.files?.insurance_file?.[0]?.path || null;
  const front_image = req.files?.front_image?.[0]?.path || null;
  const back_image = req.files?.back_image?.[0]?.path || null;
  const side_image = req.files?.side_image?.[0]?.path || null;
  const number_plate_image = req.files?.number_plate_image?.[0]?.path || null;

  const vehicleId = await Vehicle.createVehicle({
    user_id,
    vehicle_type,
    brand,
    model,
    manufacture_year,
    registration_number,
    color,
    seats,
    available_seats,
    fuel_type,
    rc_number,
    rc_expiry_date,
    insurance_provider,
    policy_number,
    insurance_expiry,
    rc_file,
    insurance_file,
    front_image,
    back_image,
    side_image,
    number_plate_image
  });

  return res.status(201).json({
    status: "success",
    message: "Vehicle added successfully.",
    vehicle_id: vehicleId
  });
};

exports.edit = async (req, res) => {
    try {

        const { id } = req.params;

        const [rows] = await db.execute(
            `SELECT * FROM vehicles
            WHERE id = ?
            LIMIT 1`,
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({
                status: "error",
                message: "Vehicle not found."
            });
        }

        const vehicle = rows[0];

        return res.json({
            status: "success",
            vehicle: formatVehicleDetails(vehicle)
        });

    } catch (err) {

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    }
};


exports.update = async (req, res) => {
    const connection = await db.getConnection();

    try {

        const { id } = req.params;

        const {
            user_id,
            vehicle_type,
            brand,
            model,
            manufacture_year,
            registration_number,
            color,
            seats,
            available_seats,
            fuel_type,
            rc_number,
            rc_expiry_date,
            insurance_provider,
            policy_number,
            insurance_expiry
        } = req.body;

        // Validation
        if (!user_id)
            return res.status(422).json({
                status: "error",
                message: "User is required"
            });

        if (!brand)
            return res.status(422).json({
                status: "error",
                message: "Brand is required"
            });

        if (!model)
            return res.status(422).json({
                status: "error",
                message: "Model is required"
            });

        // Check Vehicle
        const [vehicleRows] = await connection.query(
            "SELECT * FROM vehicles WHERE id=? LIMIT 1",
            [id]
        );

        if (!vehicleRows.length) {
            return res.status(404).json({
                status: "error",
                message: "Vehicle not found."
            });
        }

        const vehicle = vehicleRows[0];

        // Unique Registration Number
        const [registrationExists] = await connection.query(
            `SELECT id
                FROM vehicles
                WHERE registration_number = ?
                AND id != ?
                LIMIT 1`,
            [registration_number, id]
        );

        if (registrationExists.length) {
            return res.status(422).json({
                status: "error",
                message: "Registration number already exists."
            });
        }

        // Unique RC Number
        const [rcExists] = await connection.query(
            `SELECT id
                FROM vehicles
                WHERE rc_number = ?
                AND id != ?
                LIMIT 1`,
            [rc_number, id]
        );

        if (rcExists.length) {
            return res.status(422).json({
                status: "error",
                message: "RC Number already exists."
            });
        }

        await connection.beginTransaction();

        const uploadDir = path.join(__dirname, "../public/uploads/vehicle");

        const deleteOldFile = (filename) => {
            if (!filename) return;

            const filePath = path.join(uploadDir, filename);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        };

        let rc_file = vehicle.rc_file;
        let insurance_file = vehicle.insurance_file;
        let front_image = vehicle.front_image;
        let back_image = vehicle.back_image;
        let side_image = vehicle.side_image;
        let number_plate_image = vehicle.number_plate_image;

        if (req.files?.rc_file?.length) {
            deleteOldFile(vehicle.rc_file);
            rc_file = req.files.rc_file[0].filename;
        }

        if (req.files?.insurance_file?.length) {
            deleteOldFile(vehicle.insurance_file);
            insurance_file = req.files.insurance_file[0].filename;
        }

        if (req.files?.front_image?.length) {
            deleteOldFile(vehicle.front_image);
            front_image = req.files.front_image[0].filename;
        }

        if (req.files?.back_image?.length) {
            deleteOldFile(vehicle.back_image);
            back_image = req.files.back_image[0].filename;
        }

        if (req.files?.side_image?.length) {
            deleteOldFile(vehicle.side_image);
            side_image = req.files.side_image[0].filename;
        }

        if (req.files?.number_plate_image?.length) {
            deleteOldFile(vehicle.number_plate_image);
            number_plate_image = req.files.number_plate_image[0].filename;
        }

        await connection.query(
            `UPDATE vehicles SET
                user_id=?,
                vehicle_type=?,
                brand=?,
                model=?,
                manufacture_year=?,
                registration_number=?,
                color=?,
                seats=?,
                available_seats=?,
                fuel_type=?,
                rc_number=?,
                rc_expiry_date=?,
                insurance_provider=?,
                policy_number=?,
                insurance_expiry=?,
                rc_file=?,
                insurance_file=?,
                front_image=?,
                back_image=?,
                side_image=?,
                number_plate_image=?,
                updated_at=NOW()
            WHERE id=?`,
            [
                user_id,
                vehicle_type || "Car",
                brand,
                model,
                manufacture_year,
                registration_number,
                color,
                seats,
                available_seats,
                fuel_type,
                rc_number,
                rc_expiry_date,
                insurance_provider,
                policy_number,
                insurance_expiry,
                rc_file,
                insurance_file,
                front_image,
                back_image,
                side_image,
                number_plate_image,
                id
            ]
        );

        await connection.commit();

        return res.json({
            status: "success",
            message: "Vehicle data updated successfully"
        });

    } catch (err) {

        await connection.rollback();

        return res.status(500).json({
            status: "error",
            message: err.message
        });

    } finally {

        connection.release();

    }
};
// Private function to format vehicle details for clean response
function formatVehicleDetails(vehicle) {

    return {
        id: vehicle.id,
        user_id: vehicle.user_id,

        vehicle_type: vehicle.vehicle_type,
        brand: vehicle.brand,
        model: vehicle.model,

        manufacture_year: vehicle.manufacture_year,
        registration_number: vehicle.registration_number,

        color: vehicle.color,
        seats: vehicle.seats,
        fuel_type: vehicle.fuel_type,

        rc_number: vehicle.rc_number,
        rc_expiry_date: vehicle.rc_expiry_date,

        insurance_provider: vehicle.insurance_provider,
        policy_number: vehicle.policy_number,
        insurance_expiry: vehicle.insurance_expiry,

        available_seats: vehicle.available_seats,

        rc_file: vehicle.rc_file
            ? `${process.env.APP_URL}/uploads/vehicle/${vehicle.rc_file}`
            : "",

        insurance_file: vehicle.insurance_file
            ? `${process.env.APP_URL}/uploads/vehicle/${vehicle.insurance_file}`
            : "",

        front_image: vehicle.front_image
            ? `${process.env.APP_URL}/uploads/vehicle/${vehicle.front_image}`
            : "",

        back_image: vehicle.back_image
            ? `${process.env.APP_URL}/uploads/vehicle/${vehicle.back_image}`
            : "",

        side_image: vehicle.side_image
            ? `${process.env.APP_URL}/uploads/vehicle/${vehicle.side_image}`
            : "",

        number_plate_image: vehicle.number_plate_image
            ? `${process.env.APP_URL}/uploads/vehicle/${vehicle.number_plate_image}`
            : "",

        status: vehicle.status,

        created_at: vehicle.created_at
            ? new Date(vehicle.created_at)
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")
            : null
    };
}