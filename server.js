const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

// 1. Static Files
app.use(express.static(__dirname + '/public'));

// 2. Game State
let players = {}; 

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // --- JOIN LOGIC ---
    socket.on('joinRoom', (data) => {
        // Create the player object
        players[socket.id] = {
            x: 400,
            y: 300,
            id: socket.id,
            name: data.name || "Guest", 
            color: Math.random() * 0xffffff
        };

        // Send current players to the NEW player
        socket.emit('currentPlayers', players);

        // Tell EVERYONE ELSE a new player joined
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // --- MOVEMENT LOGIC ---
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) { // Safety check
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            // Tell everyone else this player moved
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // --- CHAT LOGIC ---
    socket.on('chatMessage', (message) => {
        if (players[socket.id]) { // Safety check to ensure they joined
            io.emit('newMessage', {
                name: players[socket.id].name,
                message: message
            });
        }
    });

    // --- DISCONNECT LOGIC ---
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (players[socket.id]) {
            delete players[socket.id];
            io.emit('playerDisconnected', socket.id);
        }
    });
});

// 3. Start Server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Hyggen is live! Visit: http://localhost:${PORT}`);
});