const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

// 1. Tell the server where to find your 8-bit images and scripts
app.use(express.static(__dirname + '/public'));

// 2. This object keeps track of every friend currently in the room
let players = {}; 

io.on('connection', (socket) => {
    
    socket.on('joinRoom', (data) => {
        // Create the player only AFTER they join
        players[socket.id] = {
            x: 400,
            y: 300,
            id: socket.id,
            name: data.name, // Save the name!
            color: Math.random() * 0xffffff
        };

        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // Update your chatMessage listener to use the name
    socket.on('chatMessage', (message) => {
        io.emit('newMessage', {
            name: players[socket.id].name, // Send the real name
            message: message
        });
    });
});

    // 4. Send the list of all current players ONLY to the person who just joined
    socket.emit('currentPlayers', players);

    // 5. Tell everyone ELSE that a new friend has arrived
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 6. When a player moves, update the "brain" and tell everyone else
    socket.on('playerMovement', (movementData) => {
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        players[socket.id].anim = movementData.anim; // Syncs the walking animation
        socket.broadcast.emit('playerMoved', players[socket.id]);
    });

    // 7. When someone closes the tab, remove them from the room
    socket.on('disconnect', () => {
        console.log('A friend left the room.');
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
    socket.on('chatMessage', (message) => {
        // We send it to EVERYONE, including the sender
        io.emit('newMessage', {
            id: socket.id,
            message: message
        });
    });

// 8. Start the server on port 3000
server.listen(3000, () => {
    console.log('Hyggen is live! Visit: http://localhost:3000');
});