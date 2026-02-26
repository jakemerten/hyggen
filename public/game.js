/**
 * game.js - Final Synced Multiplayer with Login & Chat Fixes
 */

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
            capture: [37, 38, 39, 40, 69] // Arrows and 'E' (69)
        }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

function preload() {
    this.load.image('floor', 'https://play.phaser.io/assets/skies/space3.png'); 
    this.load.image('chair', 'https://play.phaser.io/assets/sprites/chair.png'); 
    this.load.image('table', 'https://play.phaser.io/assets/sprites/treasure_chest.png'); 
    this.load.spritesheet('player', 'https://labs.phaser.io/assets/sprites/dude.png', { 
        frameWidth: 32, frameHeight: 48 
    });
}

function create() {
    const self = this;

    // --- 1. KEYBOARD RELAXATION (Fixes "E" at Login) ---
    // Start by letting the browser have the keys so the user can type their name
    this.input.keyboard.disableGlobalCapture();

    // --- 2. WORLD SETUP ---
    this.add.tileSprite(0, 0, 800, 600, 'floor').setOrigin(0, 0);
    this.furniture = this.physics.add.staticGroup();
    this.furniture.create(400, 300, 'table'); 

    this.chairs = this.add.group();
    const c1 = this.add.sprite(350, 300, 'chair').setData({ id: 1, occupied: false });
    const c2 = this.add.sprite(450, 300, 'chair').setData({ id: 2, occupied: false });
    this.chairs.add(c1);
    this.chairs.add(c2);

    // --- 3. INPUTS & PROMPTS ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.playerState = 'walking'; 

    this.interactPrompt = this.add.text(0, 0, '', {
        fontSize: '16px', fill: '#fff', backgroundColor: '#000', padding: { x: 6, y: 4 }
    }).setOrigin(0.5).setDepth(100).setVisible(false);

    // --- 4. UI REFERENCES ---
    const joinScreen = document.getElementById('join-screen');
    const joinButton = document.getElementById('join-button');
    const usernameInput = document.getElementById('username-input');
    const hyggenLayout = document.getElementById('hyggen-layout');
    const chatInput = document.getElementById('chat-input');
    const messageLog = document.getElementById('message-log');

    // --- 5. FOCUS LISTENERS (The "E" Fix) ---
    const inputs = [usernameInput, chatInput];
    inputs.forEach(inputField => {
        inputField.addEventListener('focus', () => {
            self.input.keyboard.enabled = false;
            self.input.keyboard.disableGlobalCapture();
        });
        inputField.addEventListener('blur', () => {
            self.input.keyboard.enabled = true;
            self.input.keyboard.enableGlobalCapture();
        });
    });

    // --- 6. JOIN BUTTON LOGIC ---
    joinButton.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (!name) return alert("Enter a name!");

        joinScreen.style.display = 'none';
        hyggenLayout.style.display = 'flex';

        // Now that the game started, let Phaser capture keys
        this.input.keyboard.enableGlobalCapture();

        this.socket = io();
        this.socket.emit('joinRoom', { name: name });

        this.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach((id) => {
                if (players[id].id === self.socket.id) addPlayer(self, players[id]);
                else addOtherPlayers(self, players[id]);
            });
        });

        this.socket.on('chairUpdate', (data) => {
            self.chairs.getChildren().forEach((chair) => {
                if (chair.getData('id') === parseInt(data.chairId)) {
                    chair.setData('occupied', data.occupied);
                    chair.setAlpha(data.occupied ? 0.5 : 1.0);
                }
            });
        });

        this.socket.on('newPlayer', (info) => addOtherPlayers(self, info));
        this.socket.on('playerMoved', (info) => {
            self.otherPlayers.getChildren().forEach((other) => {
                if (info.id === other.playerId) other.setPosition(info.x, info.y);
            });
        });
        this.socket.on('playerDisconnected', (id) => {
            self.otherPlayers.getChildren().forEach((other) => {
                if (id === other.playerId) other.destroy();
            });
        });
        this.socket.on('newMessage', (data) => {
            const msg = document.createElement('div');
            msg.innerHTML = `<strong style="color: #0f0;">${data.name}:</strong> ${data.message}`;
            messageLog.appendChild(msg);
            messageLog.scrollTop = messageLog.scrollHeight;
        });
    });

    this.otherPlayers = this.add.group();

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim() !== "" && self.socket) {
            self.socket.emit('chatMessage', chatInput.value);
            chatInput.value = "";
            chatInput.blur(); // Re-focuses the game
        }
    });
}

// 7. THE UPDATE LOOP
function update() {
    // Safety Guard: Stop if chatting or not spawned
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

        // Proximity Check
        let closestChair = null;
        this.chairs.getChildren().forEach((chair) => {
            const dist = Phaser.Math.Distance.Between(this.playerContainer.x, this.playerContainer.y, chair.x, chair.y);
            if (dist < 50 && !chair.getData('occupied')) closestChair = chair;
        });

        if (closestChair) {
            this.interactPrompt.setPosition(closestChair.x, closestChair.y - 40).setText('[E] SIT').setVisible(true);
            if (Phaser.Input.Keyboard.JustDown(this.interactKey)) sitDown(this, closestChair);
        }
    } 
    else if (this.playerState === 'sitting') {
        this.interactPrompt.setPosition(this.playerContainer.x, this.playerContainer.y - 60).setText('[E] STAND').setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.interactKey)) standUp(this);
    }
}

// 8. HELPERS
function addPlayer(self, info) {
    const sprite = self.add.sprite(0, 0, 'player').setOrigin(0.5, 0.5);
    sprite.setTint(info.color);
    const label = self.add.text(0, -40, info.name, { fontSize: '14px', backgroundColor: '#000' }).setOrigin(0.5);
    self.playerContainer = self.add.container(info.x, info.y, [sprite, label]);
    self.physics.world.enable(self.playerContainer);
}

function addOtherPlayers(self, info) {
    const sprite = self.add.sprite(0, 0, 'player').setOrigin(0.5, 0.5);
    sprite.setTint(info.color);
    const label = self.add.text(0, -40, info.name, { fontSize: '12px', backgroundColor: '#333' }).setOrigin(0.5);
    const container = self.add.container(info.x, info.y, [sprite, label]);
    container.playerId = info.id;
    self.otherPlayers.add(container);
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