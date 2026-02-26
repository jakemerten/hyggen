/**
 * game.js - Final Stable Build (Sierrassets Spritesheet Edition)
 */

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    pixelArt: true, // This makes the 16x16 pixel art look crisp and sharp
    physics: {
        default: 'arcade',
        arcade: { 
            gravity: { y: 0 },
            debug: false 
        }
    },
    input: {
        keyboard: { 
            capture: [37, 38, 39, 40, 69] // Arrows and 'E'
        }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

function preload() {
    // 1. Load the furniture spritesheet (Each tile is 16x16 pixels)
    this.load.spritesheet('furniture_sheet', 'furniture spritesheet.png', { 
        frameWidth: 16, frameHeight: 16 
    });

    // 2. Load the player sprite
    this.load.spritesheet('player', 'https://labs.phaser.io/assets/sprites/dude.png', { 
        frameWidth: 32, frameHeight: 48 
    });
}

function create() {
    const self = this;
    const TILE_W = 100;
    const TILE_H = 75;

    this.input.keyboard.disableGlobalCapture();

    // Map Grid Layout (0: Floor, 1: Fireplace, 2: Table, 3: Chairs/Seating)
    const roomMap = [
        [0, 0, 1, 1, 1, 1, 0, 0], // Row 0: Fireplace
        [0, 3, 0, 0, 0, 0, 3, 3], // Row 1: Armchair (L) and 2-tile Couch (R)
        [0, 0, 0, 0, 0, 0, 0, 0], 
        [0, 0, 0, 3, 0, 0, 0, 0], // Row 3: Table Top Chair
        [0, 0, 3, 2, 2, 3, 0, 0], // Row 4: Table + Side Chairs
        [0, 0, 0, 3, 0, 0, 0, 0], // Row 5: Table Bottom Chair
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0] 
    ];

    this.solidFurniture = this.physics.add.staticGroup();
    this.chairs = this.add.group();
    let interactableCount = 0;

    roomMap.forEach((row, rIdx) => {
        row.forEach((tile, cIdx) => {
            const x = (cIdx * TILE_W) + (TILE_W / 2);
            const y = (rIdx * TILE_H) + (TILE_H / 2);

            // Layer 1: Floor
            // Using a dark wood-colored rectangle for a reliable "floor" look
            this.add.rectangle(x, y, TILE_W, TILE_H, 0x2e2118).setStrokeStyle(1, 0x1a1a1a);

            if (tile === 1) { 
                // FIREPLACE: Pick a frame from your sheet (e.g., frame 4)
                this.solidFurniture.create(x, y, 'furniture_sheet', 4).setScale(4).refreshBody();
            } 
            else if (tile === 2) { 
                // TABLE: Pick a wooden table frame (e.g., frame 18)
                this.solidFurniture.create(x, y, 'furniture_sheet', 18).setScale(4).refreshBody();
            } 
            else if (tile === 3) { 
                interactableCount++;
                let frameIdx = 135; // Default wood chair frame
                
                // Specific Seating logic
                if (rIdx === 1 && cIdx === 1) frameIdx = 138; // Armchair
                else if (rIdx === 1 && cIdx > 5) frameIdx = 81; // Couch/Bench
                
                const sitPlace = this.add.sprite(x, y, 'furniture_sheet', frameIdx).setScale(4);
                sitPlace.setData({ id: interactableCount, occupied: false });
                this.chairs.add(sitPlace);
            }
        });
    });

    // C. MULTIPLAYER & INTERACTION LOGIC
    this.cursors = this.input.keyboard.createCursorKeys();
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.playerState = 'walking';

    this.interactPrompt = this.add.text(0, 0, '', {
        fontSize: '14px', fill: '#fff', backgroundColor: '#000', padding: { x: 5, y: 3 }
    }).setOrigin(0.5).setDepth(100).setVisible(false);

    // Sidebar and Socket logic remains consistent with your previous setup
    setupUIAndSockets(this);
}

function update() {
    if (!this.playerContainer || !this.input.keyboard.enabled) return;

    this.interactPrompt.setVisible(false);

    if (this.playerState === 'walking') {
        let speed = 4;
        let moved = false;
        if (this.cursors.left.isDown) { this.playerContainer.x -= speed; moved = true; }
        else if (this.cursors.right.isDown) { this.playerContainer.x += speed; moved = true; }
        if (this.cursors.up.isDown) { this.playerContainer.y -= speed; moved = true; }
        else if (this.cursors.down.isDown) { this.playerContainer.y += speed; moved = true; }
        
        if (moved) this.socket.emit('playerMovement', { x: this.playerContainer.x, y: this.playerContainer.y });

        // Interaction Check
        let closest = null;
        this.chairs.getChildren().forEach(c => {
            const d = Phaser.Math.Distance.Between(this.playerContainer.x, this.playerContainer.y, c.x, c.y);
            if (d < 50 && !c.getData('occupied')) closest = c;
        });
        if (closest) {
            this.interactPrompt.setPosition(closest.x, closest.y - 40).setText('[E] SIT').setVisible(true);
            if (Phaser.Input.Keyboard.JustDown(this.interactKey)) sitDown(this, closest);
        }
    } else if (this.playerState === 'sitting') {
        this.interactPrompt.setPosition(this.playerContainer.x, this.playerContainer.y - 60).setText('[E] STAND').setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.interactKey)) standUp(this);
    }
}

// HELPERS
function sitDown(self, chair) {
    self.playerState = 'sitting';
    self.playerContainer.setPosition(chair.x, chair.y);
    self.socket.emit('interact', { chairId: chair.getData('id'), action: 'sit' });
}

function standUp(self) {
    self.playerState = 'walking';
    self.playerContainer.y += 40; 
    self.socket.emit('interact', { action: 'stand' });
}

function setupUIAndSockets(self) {
    const joinButton = document.getElementById('join-button');
    const usernameInput = document.getElementById('username-input');
    const chatInput = document.getElementById('chat-input');
    const messageLog = document.getElementById('message-log');

    [usernameInput, chatInput].forEach(el => {
        el.addEventListener('focus', () => { self.input.keyboard.enabled = false; });
        el.addEventListener('blur', () => { self.input.keyboard.enabled = true; });
    });

    joinButton.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (!name) return alert("Enter name!");
        document.getElementById('join-screen').style.display = 'none';
        self.input.keyboard.enableGlobalCapture();
        self.socket = io();
        self.socket.emit('joinRoom', { name: name });

        self.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach((id) => {
                if (players[id].id === self.socket.id) {
                    addPlayer(self, players[id]);
                    self.physics.add.collider(self.playerContainer, self.solidFurniture);
                } else {
                    addOtherPlayers(self, players[id]);
                }
            });
        });

        self.socket.on('newMessage', (data) => {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            messageLog.innerHTML += `<div><span class="timestamp">[${time}]</span> <b>${data.name}:</b> ${data.message}</div>`;
            messageLog.scrollTop = messageLog.scrollHeight;
        });

        // Add standard playerMoved and playerDisconnected listeners here...
    });
}

function addPlayer(self, info) {
    const s = self.add.sprite(0, 0, 'player').setOrigin(0.5);
    s.setTint(info.color);
    const l = self.add.text(0, -40, info.name, { fontSize: '14px', backgroundColor: '#000' }).setOrigin(0.5);
    self.playerContainer = self.add.container(info.x, info.y, [s, l]);
    self.physics.world.enable(self.playerContainer);
    self.playerContainer.body.setSize(32, 48).setOffset(-16, -24);
}

function addOtherPlayers(self, info) {
    const s = self.add.sprite(0, 0, 'player').setOrigin(0.5);
    s.setTint(info.color);
    const l = self.add.text(0, -40, info.name, { fontSize: '12px', backgroundColor: '#333' }).setOrigin(0.5);
    const c = self.add.container(info.x, info.y, [s, l]);
    c.playerId = info.id;
    self.otherPlayers.add(c);
}