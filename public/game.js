const config = {
    type: Phaser.AUTO,
    parent: 'game-container', // Matches the ID in your index.html
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
    // Using a placeholder 8-bit character sheet
    this.load.spritesheet('player', 'https://labs.phaser.io/assets/sprites/dude.png', { 
        frameWidth: 32, 
        frameHeight: 48 
    });
}

function create() {
    const self = this;
    this.socket = io();
    this.otherPlayers = this.physics.add.group();

    // --- 1. MULTIPLAYER SYNCING ---

    // Load everyone already in the room
    this.socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            if (players[id].id === self.socket.id) {
                addPlayer(self, players[id]);
            } else {
                addOtherPlayers(self, players[id]);
            }
        });
    });

    // Handle new arrivals
    this.socket.on('newPlayer', (playerInfo) => {
        addOtherPlayers(self, playerInfo);
    });

    // Move other people's characters on your screen
    this.socket.on('playerMoved', (playerInfo) => {
        self.otherPlayers.getChildren().forEach((otherPlayer) => {
            if (playerInfo.id === otherPlayer.playerId) {
                otherPlayer.setPosition(playerInfo.x, playerInfo.y);
            }
        });
    });

    // Remove people when they leave
    this.socket.on('playerDisconnected', (playerId) => {
        self.otherPlayers.getChildren().forEach((otherPlayer) => {
            if (playerId === otherPlayer.playerId) {
                otherPlayer.destroy();
            }
        });
    });

    // --- 2. CHAT SYSTEM LOGIC ---

    const chatInput = document.getElementById('chat-input');
    const messageLog = document.getElementById('message-log');

    // FIX: Stop Phaser from "stealing" keys when you type in the box
    chatInput.addEventListener('focus', () => { this.input.keyboard.enabled = false; });
    chatInput.addEventListener('blur', () => { this.input.keyboard.enabled = true; });

    // Handle sending messages
    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const message = chatInput.value.trim();
            if (message !== "") {
                this.socket.emit('chatMessage', message);
                chatInput.value = "";
            }
        }
    });

    // Handle receiving messages
    this.socket.on('newMessage', (data) => {
        const msgElement = document.createElement('div');
        msgElement.innerHTML = `<strong>${data.id.substring(0, 5)}:</strong> ${data.message}`;
        messageLog.appendChild(msgElement);
        messageLog.scrollTop = messageLog.scrollHeight; // Auto-scroll
    });

    // Setup arrow keys
    this.cursors = this.input.keyboard.createCursorKeys();
}

function update() {
    if (this.player) {
        let moved = false;
        const speed = 4;

        if (this.cursors.left.isDown) {
            this.player.x -= speed;
            moved = true;
        } else if (this.cursors.right.isDown) {
            this.player.x += speed;
            moved = true;
        }

        if (this.cursors.up.isDown) {
            this.player.y -= speed;
            moved = true;
        } else if (this.cursors.down.isDown) {
            this.player.y += speed;
            moved = true;
        }

        // Only tell the server if we actually moved
        if (moved) {
            this.socket.emit('playerMovement', { x: this.player.x, y: this.player.y });
        }
    }
}

// --- 3. HELPER FUNCTIONS ---

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