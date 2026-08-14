// utils/emailService.js

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: process.env.MAIL_SECURE === "true",
    auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
    },
});

const sendRideCancelledEmail = async ({
    email,
    name,
    bookingCode,
    rideId,
}) => {

    await transporter.sendMail({
        from: `"Carpool" <${process.env.MAIL_FROM_ADDRESS}>`,
        to: email,
        subject: "Your Carpool Booking Has Been Cancelled",

        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Ride Cancelled</h2>

                <p>Hello ${name || "User"},</p>

                <p>
                    Your carpool booking has been automatically cancelled
                    because the driver did not start the scheduled ride on time.
                </p>

                <p>
                    <strong>Booking Code:</strong> ${bookingCode}
                </p>

                <p>
                    <strong>Ride ID:</strong> ${rideId}
                </p>

                <p>
                    If you have any questions, please contact our support team.
                </p>

                <p>
                    Regards,<br>
                    Carpool Team
                </p>
            </div>
        `,
    });
};

module.exports = {
    sendRideCancelledEmail,
};