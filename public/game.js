/**
 * game.js - Final Master Version
 * Includes: Phaser 3, Socket.io, Chat, Containers, and Background
 */

// 1. PHASER CONFIGURATION
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 } }
    },
    input: {
        keyboard: {
            capture: [37, 38, 39, 40] // Prevent browser scroll when using arrows
        }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

// 2. PRELOAD ASSETS
function preload() {
    // Background Image
    this.load.image('background', 'https://play.phaser.io/assets/skies/space3.png');

    // Player Spritesheet
    this.load.spritesheet('player', 'https://labs.phaser.io/assets/sprites/dude.png', { 
        frameWidth: 32, 
        frameHeight: 48 
    });
}

// 3. CREATE GAME WORLD
function create() {
    const self = this;

    // A. DRAW BACKGROUND FIRST (Bottom Layer)
    this.add.image(400, 300, 'background').setDisplaySize(800, 600);

    // B. UI REFERENCES
    const joinScreen = document.getElementById('join-screen');
    const joinButton = document.getElementById('join-button');
    const usernameInput = document.getElementById('username-input');
    const hyggenLayout = document.getElementById('hyggen-layout');
    const chatInput = document.getElementById('chat-input');
    const messageLog = document.getElementById('message-log');

    // C. SETUP GROUPS & INPUTS
    this.cursors = this.input.keyboard.createCursorKeys();
    this.otherPlayers = this.add.group();

    // D. JOIN BUTTON LOGIC
    joinButton.addEventListener('click', () => {
        const name = usernameInput.value.trim();

        if (name !== "") {
            joinScreen.style.display = 'none';
            hyggenLayout.style.display = 'flex';

            this.socket = io();
            this.socket.emit('joinRoom', { name: name });

            // --- MULTIPLAYER LISTENERS ---

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

            // --- CHAT MESSAGES ---
            this.socket.on('newMessage', (data) => {
                const msgElement = document.createElement('div');
                const now = new Date();
                const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                msgElement.innerHTML = `<span style="color: #888; font-size: 11px;">[${timeString}]</span> <strong style="color: #0f0;">${data.name}:</strong> ${data.message}`;
                messageLog.appendChild(msgElement);
                messageLog.scrollTop = messageLog.scrollHeight;
            });

        } else {
            alert("Please enter a name to join!");
        }
    });

    // E. CHAT FOCUS FIXES
    chatInput.addEventListener('focus', () => {
        self.input.keyboard.enabled = false;
        self.input.keyboard.disableGlobalCapture();
    });

    chatInput.addEventListener('blur', () => {
        self.input.keyboard.enabled = true;
        self.input.keyboard.enableGlobalCapture();
    });

    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const message = chatInput.value.trim();
            if (message !== "" && self.socket) {
                self.socket.emit('chatMessage', message);
                chatInput.value = "";
            }
        }
    });
}

// 4. THE UPDATE LOOP
function update() {
    if (this.playerContainer) {
        let moved = false;
        const speed = 4;

        if (this.cursors.left.isDown) { this.playerContainer.x -= speed; moved = true; }
        else if (this.cursors.right.isDown) { this.playerContainer.x += speed; moved = true; }

        if (this.cursors.up.isDown) { this.playerContainer.y -= speed; moved = true; }
        else if (this.cursors.down.isDown) { this.playerContainer.y += speed; moved = true; }

        if (moved) {
            this.socket.emit('playerMovement', { x: this.playerContainer.x, y: this.playerContainer.y });
        }
    }
}

// 5. HELPER FUNCTIONS
function addPlayer(self, playerInfo) {
    const sprite = self.add.sprite(0, 0, 'player').setOrigin(0.5, 0.5);
    sprite.setTint(playerInfo.color);

    const nameTag = self.add.text(0, -40, playerInfo.name, {
        fontSize: '14px',
        fill: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 0.5);

    self.playerContainer = self.add.container(playerInfo.x, playerInfo.y, [sprite, nameTag]);
    self.physics.world.enable(self.playerContainer);
}

function addOtherPlayers(self, playerInfo) {
    const sprite = self.add.sprite(0, 0, 'player').setOrigin(0.5, 0.5);
    sprite.setTint(playerInfo.color);

    const nameTag = self.add.text(0, -40, playerInfo.name, {
        fontSize: '14px',
        fill: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 0.5);

    const container = self.add.container(playerInfo.x, playerInfo.y, [sprite, nameTag]);
    container.playerId = playerInfo.id;
    self.otherPlayers.add(container);
}