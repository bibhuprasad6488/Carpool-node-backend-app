const { Server } = require("socket.io");

let io;

module.exports = {

    init(server) {

        io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        io.on("connection", (socket) => {

            console.log("User Connected:", socket.id);

            // Join ride room
            socket.on("join-ride", (rideId) => {
                socket.join(`ride-${rideId}`);
            });

            socket.on("disconnect", () => {
                console.log("User Disconnected:", socket.id);
            });

        });

        return io;
    },

    getIO() {

        if (!io) {
            throw new Error("Socket.IO not initialized.");
        }

        return io;
    }

};