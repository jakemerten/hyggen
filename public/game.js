/**
 * game.js - Final Multiplayer Version
 * Includes: Phaser 3, Socket.io, Chat, and Name Tags
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
            capture: [37, 38, 39, 40] // Prevent page scrolling with arrows
        }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

// 2. PRELOAD ASSETS
function preload() {
    // Load your player as before
    this.load.spritesheet('player', 'https://labs.phaser.io/assets/sprites/dude.png', { 
        frameWidth: 32, 
        frameHeight: 48 
    });

    // ADD THIS: Load the background image
    // I'm using a placeholder meadow, but you can change this URL
    this.load.image('background', 'https://labs.phaser.io/assets/skies/space3.png'); 
}

// 3. CREATE GAME WORLD
function create() {
    const self = this;

    function create() {
    const self = this;

    // 1. ADD BACKGROUND FIRST (so it's at the bottom layer)
    // We place it at 400, 300 because images are placed by their center by default
    this.add.image(400, 300, 'background').setDisplaySize(800, 600);

    // ... rest of your UI references (joinScreen, joinButton, etc.)
    const joinScreen = document.getElementById('join-screen');
    // ...
}

    // UI References
    const joinScreen = document.getElementById('join-screen');
    const joinButton = document.getElementById('join-button');
    const usernameInput = document.getElementById('username-input');
    const hyggenLayout = document.getElementById('hyggen-layout');
    const chatInput = document.getElementById('chat-input');
    const messageLog = document.getElementById('message-log');

    this.cursors = this.input.keyboard.createCursorKeys();
    this.otherPlayers = this.add.group(); // Group to hold other player containers

    // JOIN LOGIC
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

            // --- CHAT LISTENERS ---

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
                    if (message !== "") {
                        self.socket.emit('chatMessage', message);
                        chatInput.value = "";
                    }
                }
            });

            this.socket.on('newMessage', (data) => {
                const msgElement = document.createElement('div');
                const now = new Date();
                const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                msgElement.innerHTML = `<span style="color: #666; font-size: 11px;">[${timeString}]</span> <strong style="color: #0f0;">${data.name}:</strong> ${data.message}`;
                messageLog.appendChild(msgElement);
                messageLog.scrollTop = messageLog.scrollHeight;
            });

        } else {
            alert("Please enter a name!");
        }
    });
}

// 4. THE UPDATE LOOP
function update() {
    // Check for playerContainer instead of just player
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

// 5. HELPER FUNCTIONS (The "Secret Sauce" for Name Tags)

function addPlayer(self, playerInfo) {
    // Create Sprite
    const sprite = self.add.sprite(0, 0, 'player').setOrigin(0.5, 0.5);
    sprite.setTint(playerInfo.color);

    // Create Text (centered 40 pixels above sprite)
    const nameTag = self.add.text(0, -40, playerInfo.name, {
        fontSize: '14px',
        fill: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 0.5);

    // Create Container to hold both
    self.playerContainer = self.add.container(playerInfo.x, playerInfo.y, [sprite, nameTag]);
    
    // Add physics to the container so it can move
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