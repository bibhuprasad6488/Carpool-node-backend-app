require("dotenv").config();
const express = require("express");
const path = require("path");
const http = require("http");
const cors = require("cors");

const app = express();

app.set("trust proxy", 1);

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:4000",
  "http://127.0.0.1:3000",
  "http://192.168.1.4:3000",
  "https://carpooling-fe.vercel.app",
  "https://carpool-admin-next.vercel.app",
];

// Robust CORS dynamic delegate
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const sanitizedOrigin = origin.replace(/\/$/, "");

    const isAllowed =
      ALLOWED_ORIGINS.includes(sanitizedOrigin) ||
      /\.vercel\.app$/.test(sanitizedOrigin);

    if (isAllowed) {
      return callback(null, true);
    } else {
      console.error(`[CORS Blocked] Origin: ${origin}`);
      return callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use("/uploads", express.static(path.join(__dirname, "src/public/uploads")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const errorHandler = require("./src/middleware/errorMiddleware");
const webRoutes = require("./src/routes/web");
const apiRoutes = require("./src/routes/api");
const adminRoutes = require("./src/routes/admin");

app.use("/", webRoutes);
app.use("/api/v1", apiRoutes);
app.use("/api/v1/admin", adminRoutes);

// Global Error Handler
app.use(errorHandler);

const server = http.createServer(app);

const socket = require("./socket");
const initCronJobs = require("./src/tasks/cronTasks");
socket.init(server, ALLOWED_ORIGINS);

initCronJobs();

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running with Socket.IO on port ${PORT}`);
});
