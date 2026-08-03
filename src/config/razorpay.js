const Razorpay = require("razorpay");

if (!process.env.RAZORPAY_KEY || !process.env.RAZORPAY_SECRET) {
  console.warn(
    "Warning: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing from environment variables."
  );
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});

module.exports = razorpay;