const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.use(express.static(__dirname + '/public'));

// 1. Updated State: Track players AND chair status
let players = {}; 
let chairs = {
    1: { occupied: false, occupantId: null },
    2: { occupied: false, occupantId: null }
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinRoom', (data) => {
        players[socket.id] = {
            x: 400,
            y: 300,
            id: socket.id,
            name: data.name || "Guest", 
            color: Math.random() * 0xffffff,
            isSitting: false
        };

        // Send current players AND chair states to the new user
        socket.emit('currentPlayers', players);
        socket.emit('chairStates', chairs); 

        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // 2. NEW: Handle Interaction (Sit/Stand)
    socket.on('interact', (data) => {
        if (!players[socket.id]) return;

        if (data.action === 'sit') {
            const chair = chairs[data.chairId];
            
            // Only allow sitting if the chair is actually empty
            if (chair && !chair.occupied) {
                chair.occupied = true;
                chair.occupantId = socket.id;
                players[socket.id].isSitting = true;

                // Tell everyone that this chair is now taken
                io.emit('chairUpdate', { 
                    chairId: data.chairId, 
                    occupied: true, 
                    playerId: socket.id 
                });
            }
        } 
        
        else if (data.action === 'stand') {
            players[socket.id].isSitting = false;
            
            // Find which chair this player was in and free it
            Object.keys(chairs).forEach(id => {
                if (chairs[id].occupantId === socket.id) {
                    chairs[id].occupied = false;
                    chairs[id].occupantId = null;
                    io.emit('chairUpdate', { chairId: id, occupied: false });
                }
            });
        }
    });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id] && !players[socket.id].isSitting) { 
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('chatMessage', (message) => {
        if (players[socket.id]) {
            io.emit('newMessage', {
                name: players[socket.id].name,
                message: message
            });
        }
    });

    socket.on('disconnect', () => {
        // If they were sitting, free the chair before they vanish
        Object.keys(chairs).forEach(id => {
            if (chairs[id].occupantId === socket.id) {
                chairs[id].occupied = false;
                chairs[id].occupantId = null;
                io.emit('chairUpdate', { chairId: id, occupied: false });
            }
        });

        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});