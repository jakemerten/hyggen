const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 } } // No gravity for a top-down room!
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

function preload() {
    // Load a placeholder 8-bit character
    this.load.spritesheet('player', 'https://labs.phaser.io/assets/sprites/dude.png', { frameWidth: 32, frameHeight: 48 });
}

function create() {
    const self = this;
    this.socket = io(); // Connect to your server.js
    this.otherPlayers = this.physics.add.group(); // A group to hold your friends

    // 1. Ask the server who is already in the room
    this.socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            if (players[id].id === self.socket.id) {
                addPlayer(self, players[id]);
            } else {
                addOtherPlayers(self, players[id]);
            }
        });
    });

    // 2. Listen for new people joining
    this.socket.on('newPlayer', (playerInfo) => {
        addOtherPlayers(self, playerInfo);
    });

    // 3. Listen for people moving
    this.socket.on('playerMoved', (playerInfo) => {
        self.otherPlayers.getChildren().forEach((otherPlayer) => {
            if (playerInfo.id === otherPlayer.playerId) {
                otherPlayer.setPosition(playerInfo.x, playerInfo.y);
            }
        });
    });

    // 4. Listen for people leaving
    this.socket.on('playerDisconnected', (playerId) => {
        self.otherPlayers.getChildren().forEach((otherPlayer) => {
            if (playerId === otherPlayer.playerId) {
                otherPlayer.destroy(); // Remove them from the screen
            }
        });
    });

    // Setup keyboard arrows
    this.cursors = this.input.keyboard.createCursorKeys();
}

function update() {
    if (this.player) {
        // Handle Movement
        if (this.cursors.left.isDown) this.player.x -= 4;
        else if (this.cursors.right.isDown) this.player.x += 4;

        if (this.cursors.up.isDown) this.player.y -= 4;
        else if (this.cursors.down.isDown) this.player.y += 4;

        // Tell the server your new position
        this.socket.emit('playerMovement', { x: this.player.x, y: this.player.y });
    }
}

// HELPER FUNCTIONS
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