/**
 * game.js - Master Multiplayer Build
 * Features: 8x8 Map Loader, Physics Collisions, E-to-Interact, 
 * Chat Sidebar with Timestamps, and Keyboard Focus Fixes.
 */

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    pixelArt: true, // Crucial for sharp 16x16 pixel art
    physics: {
        default: 'arcade',
        arcade: { 
            gravity: { y: 0 },
            debug: false 
        }
    },
    input: {
        keyboard: { 
            capture: [37, 38, 39, 40, 69] // Capture Arrows and the 'E' key
        }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

// 1. ASSET PRELOAD
function preload() {
    // Loading the local floor asset and spritesheet
    this.load.image('floor', 'floor floor.png'); 
    this.load.spritesheet('furniture_sheet', 'furniture spritesheet.png', { 
        frameWidth: 16, frameHeight: 16 
    });
    
    this.load.spritesheet('player', 'https://labs.phaser.io/assets/sprites/dude.png', { 
        frameWidth: 32, frameHeight: 48 
    });
}

// 2. CREATE WORLD
function create() {
    const self = this;
    const TILE_W = 100;
    const TILE_H = 75;

    this.input.keyboard.disableGlobalCapture();

    // Map Grid Layout (0: Floor, 1: Fireplace, 2: Table, 3: Sit-able)
    const roomMap = [
        [0, 0, 1, 1, 1, 1, 0, 0], 
        [0, 3, 0, 0, 0, 0, 3, 3], 
        [0, 0, 0, 0, 0, 0, 0, 0], 
        [0, 0, 0, 3, 0, 0, 0, 0], 
        [0, 0, 3, 2, 2, 3, 0, 0], 
        [0, 0, 0, 3, 0, 0, 0, 0], 
        [0, 0, 0, 0, 0, 0, 0, 0], 
        [0, 0, 0, 0, 0, 0, 0, 0]
    ];

    this.furniture = this.physics.add.staticGroup();
    this.chairs = this.add.group();
    let interactableCount = 0;

    roomMap.forEach((row, rIdx) => {
        row.forEach((tile, cIdx) => {
            const x = (cIdx * TILE_W) + (TILE_W / 2);
            const y = (rIdx * TILE_H) + (TILE_H / 2);

            // Layer 1: Floor
            this.add.image(x, y, 'floor').setDisplaySize(TILE_W, TILE_H);

            if (tile === 1) { // FIREPLACE
                // Frame 4 from the spritesheet scaled up
                this.furniture.create(x, y, 'furniture_sheet', 4).setScale(4.5).refreshBody();
            } 
            else if (tile === 2) { // TABLE
                // Frame 18 for the wooden table
                this.furniture.create(x, y, 'furniture_sheet', 18).setScale(4.5).refreshBody();
            } 
            else if (tile === 3) { // CHAIRS / COUCH
                interactableCount++;
                let frame = 135; // Standard Chair
                if (rIdx === 1 && cIdx > 5) frame = 81; // Couch/Bench
                
                const sitPlace = this.add.sprite(x, y, 'furniture_sheet', frame).setScale(4);
                sitPlace.setData({ id: interactableCount, occupied: false });
                this.chairs.add(sitPlace);
            }
        });
    });

    // C. INPUTS & PROMPTS
    this.cursors = this.input.keyboard.createCursorKeys();
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.playerState = 'walking';

    this.interactPrompt = this.add.text(0, 0, '', {
        fontSize: '14px', fill: '#fff', backgroundColor: '#000', padding: { x: 5, y: 3 }
    }).setOrigin(0.5).setDepth(100).setVisible(false);

    // D. UI & MULTIPLAYER SETUP
    const usernameInput = document.getElementById('username-input');
    const chatInput = document.getElementById('chat-input');
    const joinButton = document.getElementById('join-button');
    const messageLog = document.getElementById('message-log');

    [usernameInput, chatInput].forEach(el => {
        el.addEventListener('focus', () => { 
            self.input.keyboard.enabled = false; 
            self.input.keyboard.disableGlobalCapture(); 
        });
        el.addEventListener('blur', () => { 
            self.input.keyboard.enabled = true; 
            self.input.keyboard.enableGlobalCapture(); 
        });
    });

    this.otherPlayers = this.add.group();

    joinButton.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (!name) return alert("Please enter a name!");
        
        document.getElementById('join-screen').style.display = 'none';
        self.input.keyboard.enableGlobalCapture();
        
        self.socket = io();
        self.socket.emit('joinRoom', { name: name });

        self.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach((id) => {
                if (players[id].id === self.socket.id) {
                    addPlayer(self, players[id]);
                    self.physics.add.collider(self.playerContainer, self.furniture);
                } else {
                    addOtherPlayers(self, players[id]);
                }
            });
        });

        self.socket.on('newMessage', (data) => {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            messageLog.innerHTML += `<div><span class="timestamp">[${time}]</span> <span class="username">${data.name}:</span> <span class="message-text">${data.message}</span></div>`;
            messageLog.scrollTop = messageLog.scrollHeight;
        });

        self.socket.on('playerMoved', (info) => {
            self.otherPlayers.getChildren().forEach(o => { 
                if (info.id === o.playerId) o.setPosition(info.x, info.y); 
            });
        });

        self.socket.on('playerDisconnected', (id) => {
            self.otherPlayers.getChildren().forEach(o => { if (id === o.playerId) o.destroy(); });
        });
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim() !== "" && self.socket) {
            self.socket.emit('chatMessage', chatInput.value);
            chatInput.value = "";
            chatInput.blur();
        }
    });
}

// 3. UPDATE LOOP
function update() {
    if (!this.playerContainer || !this.input.keyboard.enabled) {
        if (this.interactPrompt) this.interactPrompt.setVisible(false);
        return;
    }

    this.interactPrompt.setVisible(false);

    if (this.playerState === 'walking') {
        let moved = false;
        const speed = 4;
        if (this.cursors.left.isDown) { this.playerContainer.x -= speed; moved = true; }
        else if (this.cursors.right.isDown) { this.playerContainer.x += speed; moved = true; }
        if (this.cursors.up.isDown) { this.playerContainer.y -= speed; moved = true; }
        else if (this.cursors.down.isDown) { this.playerContainer.y += speed; moved = true; }

        if (moved) this.socket.emit('playerMovement', { x: this.playerContainer.x, y: this.playerContainer.y });

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

// 4. HELPERS
function addPlayer(self, info) {
    const s = self.add.sprite(0, 0, 'player').setOrigin(0.5);
    s.setTint(info.color);
    s.setScale(0.5); // Shrink character to fit the 16x16 world

    const l = self.add.text(0, -25, info.name, { fontSize: '12px', backgroundColor: '#000' }).setOrigin(0.5);
    
    self.playerContainer = self.add.container(info.x, info.y, [s, l]);
    self.physics.world.enable(self.playerContainer);
    
    // Optimized hitbox for the smaller character
    self.playerContainer.body.setSize(20, 20).setOffset(-10, 0);
}

function addOtherPlayers(self, info) {
    const s = self.add.sprite(0, 0, 'player').setOrigin(0.5);
    s.setTint(info.color);
    s.setScale(0.5); // Match the scale for other players

    const l = self.add.text(0, -25, info.name, { fontSize: '10px', backgroundColor: '#333' }).setOrigin(0.5);
    
    const c = self.add.container(info.x, info.y, [s, l]);
    c.playerId = info.id;
    self.otherPlayers.add(c);
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