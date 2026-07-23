require('dotenv').config();

const express = require("express");
const path = require("path");
const http = require("http");
const cors = require("cors");

const app = express();

app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.4:3000",
        "https://carpooling-fe.vercel.app",
        "https://carpool-admin-next.vercel.app"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(
    "/uploads",
    express.static(path.join(__dirname, "src/public/uploads"))
);
// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const errorHandler = require("./src/middleware/errorMiddleware");

const webRoutes = require('./src/routes/web');
const apiRoutes = require('./src/routes/api');
const adminRoutes = require('./src/routes/admin')

app.use('/', webRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes)
// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
const socket = require("./src/sockets");
socket.init(server);

const PORT = process.env.PORT || 3000;

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});