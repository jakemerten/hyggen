const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 } }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

function preload() {
    this.load.spritesheet('player', 'https://labs.phaser.io/assets/sprites/dude.png', { 
        frameWidth: 32, 
        frameHeight: 48 
    });
}

function create() {
    const self = this;
    this.socket = io();
    this.otherPlayers = this.physics.add.group();

    // --- KEYBOARD FIX ---
    // This tells Phaser: "Don't stop the browser from seeing the Space key."
    this.input.keyboard.removeCapture(32);

    // --- MULTIPLAYER SYNC ---
    this.socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            if (players[id].id === self.socket.id) {
                addPlayer(self, players[id]);
            } else {
                addOtherPlayers(self, players[id]);
            }
        });
    });

    this.socket.on('newPlayer', (playerInfo) => {
        addOtherPlayers(self, playerInfo);
    });

    this.socket.on('playerMoved', (playerInfo) => {
        self.otherPlayers.getChildren().forEach((otherPlayer) => {
            if (playerInfo.id === otherPlayer.playerId) {
                otherPlayer.setPosition(playerInfo.x, playerInfo.y);
            }
        });
    });

    this.socket.on('playerDisconnected', (playerId) => {
        self.otherPlayers.getChildren().forEach((otherPlayer) => {
            if (playerId === otherPlayer.playerId) {
                otherPlayer.destroy();
            }
        });
    });

    // --- CHAT SYSTEM ---
    const chatInput = document.getElementById('chat-input');
    const messageLog = document.getElementById('message-log');

    // Toggle keyboard focus
    chatInput.addEventListener('focus', () => { this.input.keyboard.enabled = false; });
    chatInput.addEventListener('blur', () => { this.input.keyboard.enabled = true; });

    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const message = chatInput.value.trim();
            if (message !== "") {
                this.socket.emit('chatMessage', message);
                chatInput.value = "";
            }
        }
    });

    this.socket.on('newMessage', (data) => {
        const msgElement = document.createElement('div');
        
        // 1. Get Local Timestamp
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // 2. Format message with timestamp and truncated ID
        // Note: Using a gray color for the timestamp and bold for the ID
        msgElement.innerHTML = `
            <span style="color: #666; font-size: 11px;">[${timeString}]</span> 
            <strong style="color: #0f0;">${data.id.substring(0, 5)}:</strong> 
            ${data.message}
        `;
        
        messageLog.appendChild(msgElement);
        messageLog.scrollTop = messageLog.scrollHeight;
    });

    this.cursors = this.input.keyboard.createCursorKeys();
}

function update() {
    if (this.player) {
        let moved = false;
        const speed = 4;

        if (this.cursors.left.isDown) { this.player.x -= speed; moved = true; }
        else if (this.cursors.right.isDown) { this.player.x += speed; moved = true; }

        if (this.cursors.up.isDown) { this.player.y -= speed; moved = true; }
        else if (this.cursors.down.isDown) { this.player.y += speed; moved = true; }

        if (moved) {
            this.socket.emit('playerMovement', { x: this.player.x, y: this.player.y });
        }
    }
}

// --- HELPERS ---
function addPlayer(self, playerInfo) {
    self.player = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'player').setOrigin(0.5, 0.5);
    self.player.setTint(playerInfo.color);
}

function addOtherPlayers(self, playerInfo) {
    const otherPlayer = self.add.sprite(playerInfo.x, playerInfo.y, 'player').setOrigin(0.5, 0.5);
    otherPlayer.setTint(playerInfo.color);
    otherPlayer.playerId = playerInfo.id;
    self.otherPlayers.add(otherPlayer);
}