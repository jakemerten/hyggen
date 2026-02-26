/**
 * game.js - Master Build (Sierrassets Spritesheet Edition)
 */

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    pixelArt: true, // Crucial for sharp pixel art
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    input: {
        keyboard: { capture: [37, 38, 39, 40, 69] } 
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

function preload() {
    // Load your uploaded spritesheet
    // Note: Assuming 'furniture spritesheet.png' is in your assets folder
    this.load.spritesheet('furniture', 'assets/furniture spritesheet.png', { 
        frameWidth: 16, frameHeight: 16 
    });

    // Stable placeholder for floor until you have a specific tile
    this.load.image('floor', 'https://labs.phaser.io/assets/skies/space3.png'); 
    
    this.load.spritesheet('player', 'https://labs.phaser.io/assets/sprites/dude.png', { 
        frameWidth: 32, frameHeight: 48 
    });
}

function create() {
    const self = this;
    const TILE_W = 100;
    const TILE_H = 75;

    this.input.keyboard.disableGlobalCapture();

    // Map Grid Layout
    const roomMap = [
        [0, 0, 1, 1, 1, 1, 0, 0], // Fireplace area
        [0, 3, 0, 0, 0, 0, 3, 3], // Armchair (L) and Couch (R)
        [0, 0, 0, 0, 0, 0, 0, 0], 
        [0, 0, 0, 3, 0, 0, 0, 0], // Top Chair
        [0, 0, 3, 2, 2, 3, 0, 0], // Table + Side Chairs
        [0, 0, 0, 3, 0, 0, 0, 0], // Bottom Chair
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0] 
    ];

    this.furniture = this.physics.add.staticGroup();
    this.chairs = this.add.group();
    let interactableCount = 0;

    /**
     * FRAME MAPPING (Approximate based on sierrassets sheet)
     * Fireplace: Row 1, approx frames 4-7
     * Tables: Row 1/2, approx frames 18-20
     * Chairs: Row 5+, various frames
     */
    roomMap.forEach((row, rIdx) => {
        row.forEach((tile, cIdx) => {
            const x = (cIdx * TILE_W) + (TILE_W / 2);
            const y = (rIdx * TILE_H) + (TILE_H / 2);

            this.add.image(x, y, 'floor').setDisplaySize(TILE_W, TILE_H);

            if (tile === 1) { 
                // FIREPLACE
                // We pick a stone fireplace frame (e.g., frame 4)
                this.furniture.create(x, y, 'furniture', 4).setScale(4).refreshBody();
            } 
            else if (tile === 2) { 
                // TABLE
                // Using a dark wood table frame (e.g., frame 18)
                this.furniture.create(x, y, 'furniture', 18).setScale(4).refreshBody();
            } 
            else if (tile === 3) { 
                interactableCount++;
                let frameIdx = 135; // Default simple chair frame
                
                if (rIdx === 1 && cIdx === 1) {
                    frameIdx = 138; // Comfy armchair frame
                } else if (rIdx === 1 && cIdx > 5) {
                    frameIdx = 81; // Couch/Bench frame
                }

                const sitPlace = this.add.sprite(x, y, 'furniture', frameIdx).setScale(4);
                sitPlace.setData({ id: interactableCount, occupied: false });
                this.chairs.add(sitPlace);
            }
        });
    });

    // Logic for prompts, multiplayer, and focus remains the same
    this.cursors = this.input.keyboard.createCursorKeys();
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.playerState = 'walking';
    this.interactPrompt = this.add.text(0, 0, '', {
        fontSize: '14px', fill: '#fff', backgroundColor: '#000', padding: { x: 5, y: 3 }
    }).setOrigin(0.5).setDepth(100).setVisible(false);

    // Sidebar UI setup...
    setupMultiplayer(this);
}

function update() {
    if (!this.playerContainer || !this.input.keyboard.enabled) {
        if (this.interactPrompt) this.interactPrompt.setVisible(false);
        return;
    }

    this.interactPrompt.setVisible(false);

    if (this.playerState === 'walking') {
        updateMovement(this);
        checkInteractions(this);
    } else if (this.playerState === 'sitting') {
        this.interactPrompt.setPosition(this.playerContainer.x, this.playerContainer.y - 60).setText('[E] STAND').setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.interactKey)) standUp(this);
    }
}

// --- HELPER FUNCTIONS ---

function updateMovement(self) {
    let moved = false;
    const speed = 4;
    if (self.cursors.left.isDown) { self.playerContainer.x -= speed; moved = true; }
    else if (self.cursors.right.isDown) { self.playerContainer.x += speed; moved = true; }
    if (self.cursors.up.isDown) { self.playerContainer.y -= speed; moved = true; }
    else if (self.cursors.down.isDown) { self.playerContainer.y += speed; moved = true; }
    if (moved) self.socket.emit('playerMovement', { x: self.playerContainer.x, y: self.playerContainer.y });
}

function checkInteractions(self) {
    let closest = null;
    self.chairs.getChildren().forEach(c => {
        const d = Phaser.Math.Distance.Between(self.playerContainer.x, self.playerContainer.y, c.x, c.y);
        if (d < 50 && !c.getData('occupied')) closest = c;
    });
    if (closest) {
        self.interactPrompt.setPosition(closest.x, closest.y - 40).setText('[E] SIT').setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(self.interactKey)) sitDown(self, closest);
    }
}

function sitDown(self, chair) {
    self.playerState = 'sitting';
    self.currentChair = chair;
    self.playerContainer.setPosition(chair.x, chair.y);
    self.socket.emit('interact', { chairId: chair.getData('id'), action: 'sit' });
}

function standUp(self) {
    self.playerState = 'walking';
    self.playerContainer.y += 40; 
    self.socket.emit('interact', { action: 'stand' });
}

// Dummy setup for multiplayer connection logic
function setupMultiplayer(self) {
    const joinButton = document.getElementById('join-button');
    joinButton.addEventListener('click', () => {
        document.getElementById('join-screen').style.display = 'none';
        self.input.keyboard.enableGlobalCapture();
        self.socket = io();
        // ... Socket listeners (currentPlayers, newPlayer, etc.) ...
    });
}