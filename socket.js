let io;

module.exports = {
    init: (server) => {
        io = require("socket.io")(server, {
            cors: {
                origin: "*"
            }
        });

        io.on("connection", (socket) => {
            console.log("User Connected:", socket.id);

            socket.on("disconnect", () => {
                console.log("User Disconnected:", socket.id);
            });
        });

        return io;
    },

    getIO: () => {
        if (!io) {
            throw new Error("Socket.io not initialized");
        }
        return io;
    }
};