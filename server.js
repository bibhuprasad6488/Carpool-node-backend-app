require('dotenv').config();

const express = require("express");
const path = require("path");
const http = require("http");

const app = express();

// Middlewares
app.use(express.json());
app.use(express.static("public"));


const webRoutes = require('./src/routes/web');
const apiRoutes = require('./src/routes/api');

app.use('/', webRoutes);
app.use('/api', apiRoutes);
// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
const socket = require("./src/sockets");
socket.init(server);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});