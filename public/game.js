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
    physics: {
        default: 'arcade',
        arcade: { 
            gravity: { y: 0 },
            debug: false // Set to true if you want to see the green hitboxes again
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

// 

// 1. ASSET PRELOAD
function preload() {
    // Using stable Labs URLs to prevent ERR_NAME_NOT_RESOLVED
    this.load.image('floor', 'assets/floor.png'); 
    this.load.image('chair', 'assets/chair.png'); 
    this.load.image('table', 'assets/table.png'); 
    this.load.image('fireplace', 'assets/fireplace.png');
    this.load.image('couch', 'assets/couch.png'); 
    
    this.load.spritesheet('player', 'https://labs.phaser.io/assets/sprites/dude.png', { 
        frameWidth: 32, frameHeight: 48 
    });
}

// 2. CREATE WORLD
function create() {
    const self = this;
    const TILE_W = 100;
    const TILE_H = 75;

    // A. Initial Keyboard Relaxation
    this.input.keyboard.disableGlobalCapture();

    // B. The 8x8 Map Layout
    // 0: Floor, 1: Fireplace, 2: Table, 3: Sit-able (Chair/Couch/Armchair)
    const roomMap = [
        [0, 0, 1, 1, 1, 1, 0, 0], // Row 0: Fireplace
        [0, 3, 0, 0, 0, 0, 3, 3], // Row 1: Armchair (L) and 2-tile Couch (R)
        [0, 0, 0, 0, 0, 0, 0, 0], // Row 2: Empty
        [0, 0, 0, 3, 0, 0, 0, 0], // Row 3: Table Top Chair
        [0, 0, 3, 2, 2, 3, 0, 0], // Row 4: Side Chairs + Table
        [0, 0, 0, 3, 0, 0, 0, 0], // Row 5: Table Bottom Chair
        [0, 0, 0, 0, 0, 0, 0, 0], // Row 6: Empty
        [0, 0, 0, 0, 0, 0, 0, 0]  // Row 7: Empty
    ];

    // 

    this.furniture = this.physics.add.staticGroup();
    this.chairs = this.add.group();
    let interactableCount = 0;

    roomMap.forEach((row, rIdx) => {
        row.forEach((tile, cIdx) => {
            const x = (cIdx * TILE_W) + (TILE_W / 2);
            const y = (rIdx * TILE_H) + (TILE_H / 2);

            // Layer 1: Fallback Shapes (Visible even if images fail)
            this.add.rectangle(x, y, TILE_W, TILE_H, 0x222222).setStrokeStyle(1, 0x333333);

            // Layer 2: The Images
            this.add.image(x, y, 'floor').setDisplaySize(TILE_W, TILE_H);

            if (tile === 1) { // FIREPLACE
                this.add.rectangle(x, y, TILE_W, TILE_H, 0xff4400, 0.5); // Fallback orange
                this.furniture.create(x, y, 'fireplace').setDisplaySize(TILE_W, TILE_H).refreshBody();
            } 
            else if (tile === 2) { // TABLE
                this.add.rectangle(x, y, TILE_W, TILE_H, 0x442200, 0.8); // Fallback brown
                this.furniture.create(x, y, 'table').refreshBody();
            } 
            else if (tile === 3) { // CHAIRS / COUCH
                interactableCount++;
                let texture = (rIdx === 1 && cIdx > 5) ? 'couch' : 'chair';
                
                this.add.circle(x, y, 15, 0x666666); // Fallback gray circle
                const sitPlace = this.add.sprite(x, y, texture);
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

    // HTML UI References
    const joinScreen = document.getElementById('join-screen');
    const joinButton = document.getElementById('join-button');
    const usernameInput = document.getElementById('username-input');
    const chatInput = document.getElementById('chat-input');
    const messageLog = document.getElementById('message-log');

    // D. KEYBOARD FOCUS FIXES (The "E" Fix)
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

    // E. MULTIPLAYER CONNECTION
    this.otherPlayers = this.add.group();

    joinButton.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (!name) return alert("Please enter a name!");
        
        joinScreen.style.display = 'none';
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

        self.socket.on('chairUpdate', (data) => {
            self.chairs.getChildren().forEach(c => {
                if (c.getData('id') === parseInt(data.chairId)) {
                    c.setData('occupied', data.occupied);
                    c.setAlpha(data.occupied ? 0.5 : 1.0);
                }
            });
        });

        self.socket.on('playerMoved', (info) => {
            self.otherPlayers.getChildren().forEach(o => { 
                if (info.id === o.playerId) o.setPosition(info.x, info.y); 
            });
        });

        self.socket.on('newMessage', (data) => {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const msg = document.createElement('div');
            msg.innerHTML = `<span class="timestamp">[${time}]</span> <span class="username">${data.name}:</span> <span class="message-text">${data.message}</span>`;
            messageLog.appendChild(msg);
            messageLog.scrollTop = messageLog.scrollHeight;
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

    // 

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

function sitDown(self, chair) {
    self.playerState = 'sitting';
    self.currentChair = chair;
    self.playerContainer.setPosition(chair.x, chair.y);
    self.socket.emit('interact', { chairId: chair.getData('id'), action: 'sit' });
    self.socket.emit('playerMovement', { x: chair.x, y: chair.y });
}

function standUp(self) {
    self.playerState = 'walking';
    self.playerContainer.y += 40; 
    self.socket.emit('interact', { action: 'stand' });
    self.socket.emit('playerMovement', { x: self.playerContainer.x, y: self.playerContainer.y });
    self.currentChair = null;
}