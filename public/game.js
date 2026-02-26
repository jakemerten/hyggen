/**
 * game.js - Final Master Version
 * Features: Map Loader, Physics, Sync, Interactions, and Chat Fixes
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
            debug: false // Set to true to see hitboxes
        }
    },
    input: {
        keyboard: { capture: [37, 38, 39, 40, 69] } 
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

// 1. ASSET PRELOAD
function preload() {
    this.load.image('floor', 'https://play.phaser.io/assets/sprites/asuna_by_be_honakas.png'); // Placeholder floor
    this.load.image('chair', 'https://play.phaser.io/assets/sprites/chair.png'); 
    this.load.image('table', 'https://play.phaser.io/assets/sprites/treasure_chest.png'); 
    this.load.image('fireplace', 'https://play.phaser.io/assets/sprites/phaser-dude.png'); // Placeholder fireplace
    this.load.spritesheet('player', 'https://labs.phaser.io/assets/sprites/dude.png', { 
        frameWidth: 32, frameHeight: 48 
    });
}

// 2. CREATE WORLD
function create() {
    const self = this;
    const TILE_W = 100;
    const TILE_H = 75;

    // --- A. MAP LOADER GRID ---
    // 0: Floor, 1: Fireplace, 2: Table, 3: Chair
    const roomMap = [
        [0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 2, 2, 2, 0, 0, 0],
        [0, 3, 2, 2, 2, 3, 0, 0],
        [0, 0, 2, 2, 2, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
    ];

    this.furniture = this.physics.add.staticGroup();
    this.chairs = this.add.group();
    let chairCount = 0;

    roomMap.forEach((row, rIdx) => {
        row.forEach((tile, cIdx) => {
            const x = (cIdx * TILE_W) + (TILE_W / 2);
            const y = (rIdx * TILE_H) + (TILE_H / 2);

            this.add.image(x, y, 'floor').setDisplaySize(TILE_W, TILE_H);

            if (tile === 1) {
                this.furniture.create(x, y, 'fireplace').setDisplaySize(TILE_W*2, TILE_H*2).refreshBody();
            } else if (tile === 2) {
                this.furniture.create(x, y, 'table').refreshBody();
            } else if (tile === 3) {
                chairCount++;
                const chair = this.add.sprite(x, y, 'chair');
                chair.setData({ id: chairCount, occupied: false });
                this.chairs.add(chair);
            }
        });
    });

    

    // --- B. UI & INPUT SETUP ---
    this.input.keyboard.disableGlobalCapture();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.playerState = 'walking';

    this.interactPrompt = this.add.text(0, 0, '', {
        fontSize: '16px', fill: '#fff', backgroundColor: '#000', padding: { x: 6, y: 4 }
    }).setOrigin(0.5).setDepth(100).setVisible(false);

    const joinScreen = document.getElementById('join-screen');
    const joinButton = document.getElementById('join-button');
    const usernameInput = document.getElementById('username-input');
    const chatInput = document.getElementById('chat-input');

    // --- C. KEYBOARD FOCUS FIXES ---
    [usernameInput, chatInput].forEach(el => {
        el.addEventListener('focus', () => { self.input.keyboard.enabled = false; self.input.keyboard.disableGlobalCapture(); });
        el.addEventListener('blur', () => { self.input.keyboard.enabled = true; self.input.keyboard.enableGlobalCapture(); });
    });

    // --- D. MULTIPLAYER LOGIC ---
    this.otherPlayers = this.add.group();
    joinButton.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (!name) return alert("Enter a name!");
        
        joinScreen.style.display = 'none';
        this.input.keyboard.enableGlobalCapture();
        this.socket = io();
        this.socket.emit('joinRoom', { name: name });

        this.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach((id) => {
                if (players[id].id === self.socket.id) {
                    addPlayer(self, players[id]);
                    self.physics.add.collider(self.playerContainer, self.furniture);
                } else {
                    addOtherPlayers(self, players[id]);
                }
            });
        });

        this.socket.on('chairUpdate', (data) => {
            self.chairs.getChildren().forEach(c => {
                if (c.getData('id') === parseInt(data.chairId)) {
                    c.setData('occupied', data.occupied);
                    c.setAlpha(data.occupied ? 0.5 : 1.0);
                }
            });
        });

        this.socket.on('playerMoved', (info) => {
            self.otherPlayers.getChildren().forEach(o => { if (info.id === o.playerId) o.setPosition(info.x, info.y); });
        });

        this.socket.on('playerDisconnected', (id) => {
            self.otherPlayers.getChildren().forEach(o => { if (id === o.playerId) o.destroy(); });
        });
    });
}

// 3. GAME LOOP
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