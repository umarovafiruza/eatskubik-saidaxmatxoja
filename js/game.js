// EatsKubik 2D - HTML5 Canvas Engine (Top-down / Isometric 2D IO Game)

// --- GAME CONSTANTS & STATE ---
const MAP_SIZE = 3200; // 3200x3200 2D World
const TILE_SIZE = 80;  // Checkerboard tile size
const MAX_FOOD = 200;
const BOTS_COUNT = 18;

let gameState = {
    score: 0,
    wins: 0,
    name: 'blo2587',
    skin: 'default',
    isAuto: false,
    speedMultiplier: 1.0,
    boostEndTime: 0,
    isGameOver: false,
    rank: 1
};

// Color palettes
const CUBE_COLORS = [
    { main: '#1e88e5', dark: '#1565c0' }, // Blue
    { main: '#43a047', dark: '#2e7d32' }, // Green
    { main: '#e53935', dark: '#c62828' }, // Red
    { main: '#fdd835', dark: '#fbc02d' }, // Yellow
    { main: '#8e24aa', dark: '#6a1b9a' }, // Purple
    { main: '#00acc1', dark: '#00838f' }, // Cyan
    { main: '#f57c00', dark: '#ef6c00' }, // Orange
    { main: '#d81b60', dark: '#ad1457' }  // Pink
];

const BOT_NAMES = [
    'Nathan', 'G3N3R4LZ', 'vortexP8', 'n0va5', 'Oliver', 
    'Michael', 'Sarah', 'Alex_99', 'ShadowCube', 'Maximus',
    'PixelKing', 'MegaBox', 'TurboCube', 'HyperX', 'Vortex_1'
];

// Canvas & Engine
let canvas, ctx;
let camera = { x: 0, y: 0, zoom: 1.0 };
let player = { x: 0, y: 0, score: 0, angle: 0, color: CUBE_COLORS[0] };
let foodList = [];
let botsList = [];
let audioCtx = null;

// Input & Pointer
let mousePos = { x: 0, y: 0 };
let inputVector = { x: 0, y: 0 };
let isPointerDown = false;
let touchJoystick = { active: false, x: 0, y: 0 };

// UI References
const elWinsCount = document.getElementById('wins-count');
const elScoreCount = document.getElementById('score-count');
const elFloatingContainer = document.getElementById('floating-labels-container');
const elLeaderboardPanel = document.getElementById('leaderboard-panel');
const elBtnAuto = document.getElementById('btn-auto');
const elBtnSpeedBoost = document.getElementById('btn-speed-boost');
const elSkinsModal = document.getElementById('skins-modal');
const elWheelModal = document.getElementById('wheel-modal');
const elGiftModal = document.getElementById('gift-modal');
const elGameOverModal = document.getElementById('gameover-modal');
const elFinalScore = document.getElementById('final-score');
const elFinalRank = document.getElementById('final-rank');

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    resetPlayer();
    spawnFood();
    spawnBots();
    setupEventListeners();
    setupModals();
    setupJoystick();

    // Start 2D render loop
    requestAnimationFrame(gameLoop);
});

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function resetPlayer() {
    player.x = 0;
    player.y = 0;
    player.score = gameState.score;
    player.angle = 0;
}

// --- AUDIO SYSTEM (Procedural Web Audio API) ---
function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'eatFood') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.exponentialRampToValueAtTime(850, now + 0.08);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'eatBot') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(700, now + 0.18);
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.18);
            osc.start(now);
            osc.stop(now + 0.18);
        } else if (type === 'boost') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'spin') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.04);
            osc.start(now);
            osc.stop(now + 0.04);
        } else if (type === 'gameover') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(150, now + 0.5);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        }
    } catch(e) {}
}

// --- SPAWNERS ---
function spawnFood() {
    foodList = [];
    for (let i = 0; i < MAX_FOOD; i++) {
        const pos = getRandomPos();
        const roll = Math.random();

        if (roll < 0.12) {
            // Mega Gold Food (12%)
            foodList.push({
                x: pos.x,
                y: pos.y,
                size: 38, // Large mega food
                type: 'mega',
                value: 8,
                color: { main: '#ffd700', dark: '#ff8f00' },
                phase: Math.random() * Math.PI * 2
            });
        } else if (roll < 0.24) {
            // Speed Crystal (12%)
            foodList.push({
                x: pos.x,
                y: pos.y,
                size: 30,
                type: 'speed',
                value: 4,
                color: { main: '#00e5ff', dark: '#0097a7' },
                phase: Math.random() * Math.PI * 2
            });
        } else {
            // Normal Food (76%) -> 26px size (almost double old 16px)
            const color = CUBE_COLORS[Math.floor(Math.random() * CUBE_COLORS.length)];
            foodList.push({
                x: pos.x,
                y: pos.y,
                size: 26,
                type: 'normal',
                value: 2,
                color: color,
                phase: Math.random() * Math.PI * 2
            });
        }
    }
}

function spawnBots() {
    botsList = [];
    for (let i = 0; i < BOTS_COUNT; i++) {
        const name = BOT_NAMES[i % BOT_NAMES.length];
        
        // 100% FAIR START: Every bot starts at score 0!
        let score = 0;

        const pos = getRandomPos();
        const color = CUBE_COLORS[Math.floor(Math.random() * CUBE_COLORS.length)];

        botsList.push({
            x: pos.x,
            y: pos.y,
            name: name,
            score: score,
            color: color,
            targetX: pos.x,
            targetY: pos.y,
            timer: 0,
            angle: Math.random() * Math.PI * 2
        });
    }
}

function getRandomPos() {
    const margin = 100;
    return {
        x: (Math.random() - 0.5) * (MAP_SIZE - margin * 2),
        y: (Math.random() - 0.5) * (MAP_SIZE - margin * 2)
    };
}

// --- SIZE & SCALE ---
function getRadiusForScore(score) {
    // Immediate, dramatic, and visible growth!
    return 26 + Math.sqrt(score) * 6.5 + Math.log10(1 + score * 2) * 12;
}

function formatScore(score) {
    if (score >= 1000) {
        return (score / 1000).toFixed(1).replace('.', ',') + 'K';
    }
    return score.toString();
}

// --- MAIN GAME LOOP ---
let lastTime = performance.now();
function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (!gameState.isGameOver) {
        updatePlayer(dt);
        updateBots(dt);
        checkCollisions();
        updateCamera();
        updateUI();
    }

    render2D();

    requestAnimationFrame(gameLoop);
}

// --- PLAYER MOVEMENT ---
function updatePlayer(dt) {
    const currentRadius = getRadiusForScore(gameState.score);
    const baseSpeed = 220 * (1 / Math.pow(currentRadius / 26, 0.3)) * gameState.speedMultiplier;

    let moveX = 0, moveY = 0;

    if (gameState.isAuto) {
        const target = findNearestTarget(player.x, player.y, gameState.score);
        if (target) {
            const dx = target.x - player.x;
            const dy = target.y - player.y;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
                moveX = dx / len;
                moveY = dy / len;
            }
        }
    } else if (inputVector.x !== 0 || inputVector.y !== 0) {
        moveX = inputVector.x;
        moveY = inputVector.y;
    } else if (isPointerDown || mousePos.x !== 0 || mousePos.y !== 0) {
        // Pointer direction relative to screen center
        const screenCenterX = canvas.width / 2;
        const screenCenterY = canvas.height / 2;
        const dx = mousePos.x - screenCenterX;
        const dy = mousePos.y - screenCenterY;
        const len = Math.hypot(dx, dy);
        if (len > 20) {
            moveX = dx / len;
            moveY = dy / len;
        }
    }

    if (moveX !== 0 || moveY !== 0) {
        player.x += moveX * baseSpeed * dt;
        player.y += moveY * baseSpeed * dt;
        player.angle = Math.atan2(moveY, moveX);

        // Map boundary clamp
        const halfMap = MAP_SIZE / 2 - currentRadius;
        player.x = Math.max(-halfMap, Math.min(halfMap, player.x));
        player.y = Math.max(-halfMap, Math.min(halfMap, player.y));
    }
}

// --- AI BOTS MOVEMENT ---
function updateBots(dt) {
    botsList.forEach(bot => {
        const radius = getRadiusForScore(bot.score);
        let speed = 190 * (1 / Math.pow(radius / 26, 0.3));

        // 1. DANGER CHECK: Flee from larger threats
        let fleeX = 0, fleeY = 0, hasDanger = false;
        let closestDanger = 99999;

        if (!gameState.isGameOver && gameState.score > bot.score * 1.1) {
            const d = Math.hypot(bot.x - player.x, bot.y - player.y);
            if (d < 450) {
                fleeX = bot.x - player.x;
                fleeY = bot.y - player.y;
                hasDanger = true;
                closestDanger = d;
            }
        }

        botsList.forEach(other => {
            if (other !== bot && other.score > bot.score * 1.1) {
                const d = Math.hypot(bot.x - other.x, bot.y - other.y);
                if (d < 450 && d < closestDanger) {
                    fleeX = bot.x - other.x;
                    fleeY = bot.y - other.y;
                    hasDanger = true;
                    closestDanger = d;
                }
            }
        });

        // 2. TARGET SELECTION (FLEE vs HUNT vs FOOD)
        if (hasDanger) {
            const len = Math.hypot(fleeX, fleeY);
            if (len > 0) {
                bot.targetX = bot.x + (fleeX / len) * 300;
                bot.targetY = bot.y + (fleeY / len) * 300;
                speed *= 1.25; // Panic speed
            }
        } else {
            const prey = findPreyOrFood2D(bot.x, bot.y, bot.score);
            if (prey) {
                bot.targetX = prey.x;
                bot.targetY = prey.y;
                if (prey.isPrey) {
                    speed *= 1.25; // Predator chase speed!
                }
            } else {
                bot.timer -= dt;
                if (bot.timer <= 0 || Math.hypot(bot.targetX - bot.x, bot.targetY - bot.y) < 30) {
                    const rnd = getRandomPos();
                    bot.targetX = rnd.x;
                    bot.targetY = rnd.y;
                    bot.timer = Math.random() * 2 + 1;
                }
            }
        }

        const dx = bot.targetX - bot.x;
        const dy = bot.targetY - bot.y;
        const len = Math.hypot(dx, dy);

        if (len > 5) {
            bot.x += (dx / len) * speed * dt;
            bot.y += (dy / len) * speed * dt;
            bot.angle = Math.atan2(dy, dx);

            const halfMap = MAP_SIZE / 2 - radius;
            bot.x = Math.max(-halfMap, Math.min(halfMap, bot.x));
            bot.y = Math.max(-halfMap, Math.min(halfMap, bot.y));
        }
    });
}

function findPreyOrFood2D(x, y, myScore) {
    let nearestPreyDist = 99999;
    let nearestPrey = null;

    // A. Check if Player is prey
    if (!gameState.isGameOver && myScore > gameState.score * 1.1) {
        const d = Math.hypot(x - player.x, y - player.y);
        if (d < 800) {
            nearestPreyDist = d;
            nearestPrey = { x: player.x, y: player.y, isPrey: true };
        }
    }

    // B. Check if another Bot is prey
    botsList.forEach(other => {
        if (myScore > other.score * 1.1) {
            const d = Math.hypot(x - other.x, y - other.y);
            if (d < 800 && d < nearestPreyDist) {
                nearestPreyDist = d;
                nearestPrey = { x: other.x, y: other.y, isPrey: true };
            }
        }
    });

    if (nearestPrey) return nearestPrey;

    // C. Otherwise find food
    let nearestFoodDist = 99999;
    let nearestFood = null;
    foodList.forEach(f => {
        const d = Math.hypot(x - f.x, y - f.y);
        if (d < nearestFoodDist) {
            nearestFoodDist = d;
            nearestFood = { x: f.x, y: f.y, isPrey: false };
        }
    });

    return nearestFood;
}

function findNearestTarget(x, y, myScore) {
    const target = findPreyOrFood2D(x, y, myScore);
    return target ? { x: target.x, y: target.y } : null;
}

// --- COLLISION LOGIC ---
function checkCollisions() {
    const playerRadius = getRadiusForScore(gameState.score);

    // 1. Player eating food with Magnetism
    if (!gameState.isGameOver) {
        const eatDist = playerRadius + 18;
        const magnetDist = playerRadius + 65;
        foodList.forEach(f => {
            const dx = player.x - f.x;
            const dy = player.y - f.y;
            const dist = Math.hypot(dx, dy);

            if (dist < eatDist) {
                const pos = getRandomPos();
                f.x = pos.x;
                f.y = pos.y;
                gameState.score += 2;
                playSound('eatFood');
            } else if (dist < magnetDist) {
                f.x += (dx / dist) * 14;
                f.y += (dy / dist) * 14;
            }
        });
    }

    // 2. Player interacting with bots
    botsList.forEach(bot => {
        const botRadius = getRadiusForScore(bot.score);

        if (!gameState.isGameOver) {
            const dist = Math.hypot(player.x - bot.x, player.y - bot.y);

            if (dist < playerRadius + botRadius - 10) {
                if (gameState.score > bot.score * 1.1) {
                    // Player eats bot
                    gameState.score += Math.floor(bot.score * 0.45) + 20;
                    playSound('eatBot');
                    const pos = getRandomPos();
                    bot.x = pos.x;
                    bot.y = pos.y;
                    bot.score = 0; // Fair respawn at 0
                } else if (bot.score > gameState.score * 1.1) {
                    // Bot eats Player! Game Over
                    triggerGameOver();
                }
            }
        }

        // 3. Bot eating food
        foodList.forEach(f => {
            if (Math.hypot(bot.x - f.x, bot.y - f.y) < botRadius + f.size / 2) {
                const pos = getRandomPos();
                f.x = pos.x;
                f.y = pos.y;
                bot.score += (f.value || 2);
            }
        });
    });

    // 4. BOT-VS-BOT EATING
    for (let i = 0; i < botsList.length; i++) {
        const botA = botsList[i];
        const radA = getRadiusForScore(botA.score);

        for (let j = i + 1; j < botsList.length; j++) {
            const botB = botsList[j];
            const radB = getRadiusForScore(botB.score);

            const dist = Math.hypot(botA.x - botB.x, botA.y - botB.y);
            if (dist < radA + radB - 10) {
                if (botA.score > botB.score * 1.1) {
                    botA.score += Math.floor(botB.score * 0.4) + 15;
                    const pos = getRandomPos();
                    botB.x = pos.x;
                    botB.y = pos.y;
                    botB.score = 0; // Fair respawn at 0
                } else if (botB.score > botA.score * 1.1) {
                    botB.score += Math.floor(botA.score * 0.4) + 15;
                    const pos = getRandomPos();
                    botA.x = pos.x;
                    botA.y = pos.y;
                    botA.score = 0; // Fair respawn at 0
                }
            }
        }
    }
}

// --- CAMERA UPDATE ---
function updateCamera() {
    // Smooth camera follow
    camera.x += (player.x - camera.x) * 0.1;
    camera.y += (player.y - camera.y) * 0.1;

    // Dynamic zoom based on player size
    const pRadius = getRadiusForScore(gameState.score);
    const targetZoom = Math.max(0.45, 1 / (1 + (pRadius - 26) * 0.0035));
    camera.zoom += (targetZoom - camera.zoom) * 0.05;
}

// --- 2D RENDERING ENGINE ---
function render2D() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Translate origin to screen center and apply camera offset & zoom
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // 1. DRAW CHECKERBOARD TILE FLOOR
    drawCheckerboard();

    // 2. DRAW MAP BOUNDARIES
    drawMapBounds();

    // 3. DRAW FOOD
    drawFood();

    // 4. DRAW PLAYER TARGET RING
    drawPlayerRing();

    // 5. DRAW BOTS CUBES & LABELS
    botsList.forEach(bot => {
        drawCube(bot.x, bot.y, getRadiusForScore(bot.score) * 2, bot.color, 'default', bot.angle);
        drawFloatingLabel2D(bot.x, bot.y, getRadiusForScore(bot.score), bot.name, bot.score, false);
    });

    // 6. DRAW PLAYER CUBE & LABEL
    if (!gameState.isGameOver) {
        drawCube(player.x, player.y, getRadiusForScore(gameState.score) * 2, getPlayerColor(), gameState.skin, player.angle);
        drawFloatingLabel2D(player.x, player.y, getRadiusForScore(gameState.score), gameState.name, gameState.score, true);
    }

    ctx.restore();
}

function getPlayerColor() {
    if (gameState.skin === 'yellow-cool') return { main: '#ffee58', dark: '#fbc02d' };
    if (gameState.skin === 'red-angry') return { main: '#ef5350', dark: '#c62828' };
    if (gameState.skin === 'ninja') return { main: '#37474F', dark: '#212121' };
    if (gameState.skin === 'robot') return { main: '#26c6da', dark: '#00838f' };
    if (gameState.skin === 'gold') return { main: '#ffca28', dark: '#ff8f00' };
    return CUBE_COLORS[0];
}

// Draw checkerboard floor matching screenshot colors!
function drawCheckerboard() {
    const startX = Math.floor((camera.x - (canvas.width / camera.zoom) / 2) / TILE_SIZE) * TILE_SIZE;
    const endX = Math.ceil((camera.x + (canvas.width / camera.zoom) / 2) / TILE_SIZE) * TILE_SIZE;
    const startY = Math.floor((camera.y - (canvas.height / camera.zoom) / 2) / TILE_SIZE) * TILE_SIZE;
    const endY = Math.ceil((camera.y + (canvas.height / camera.zoom) / 2) / TILE_SIZE) * TILE_SIZE;

    for (let x = startX; x < endX; x += TILE_SIZE) {
        for (let y = startY; y < endY; y += TILE_SIZE) {
            const isAlt = (Math.abs(Math.floor(x / TILE_SIZE)) + Math.abs(Math.floor(y / TILE_SIZE))) % 2 === 0;
            ctx.fillStyle = isAlt ? '#d0e6f7' : '#e6f2fc';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }
    }
}

function drawMapBounds() {
    const half = MAP_SIZE / 2;
    ctx.strokeStyle = '#ef5350';
    ctx.lineWidth = 12;
    ctx.strokeRect(-half, -half, MAP_SIZE, MAP_SIZE);
}

function drawFood() {
    const time = performance.now() * 0.003;
    foodList.forEach(f => {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(time + f.phase);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(-f.size/2 + 3, -f.size/2 + 3, f.size, f.size);

        // Food cube body
        ctx.fillStyle = f.color.main;
        ctx.fillRect(-f.size/2, -f.size/2, f.size, f.size);
        ctx.strokeStyle = f.color.dark;
        ctx.lineWidth = 2;
        ctx.strokeRect(-f.size/2, -f.size/2, f.size, f.size);

        ctx.restore();
    });
}

// White dashed ring underneath player (Matching screenshot!)
let ringRotation = 0;
function drawPlayerRing() {
    ringRotation += 0.015;
    const radius = getRadiusForScore(gameState.score) * 1.45;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(ringRotation);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

// 2D Beveled Pseudo-3D Cube Rendering
function drawCube(x, y, size, colorObj, skinType, angle) {
    ctx.save();
    ctx.translate(x, y);

    // Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.roundRect(-size/2 + 6, -size/2 + 8, size, size, 12);
    ctx.fill();

    // Base Cube body
    ctx.fillStyle = colorObj.main;
    ctx.beginPath();
    ctx.roundRect(-size/2, -size/2, size, size, 12);
    ctx.fill();

    // Bevel Border
    ctx.strokeStyle = colorObj.dark;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Draw Face Expressions
    drawFaceExpression(size, skinType);

    ctx.restore();
}

function drawFaceExpression(size, skinType) {
    const scale = size / 60;
    ctx.save();
    ctx.scale(scale, scale);

    if (skinType === 'yellow-cool') {
        // Sunglasses 😎
        ctx.fillStyle = '#111';
        ctx.fillRect(-22, -12, 18, 14);
        ctx.fillRect(4, -12, 18, 14);
        ctx.fillRect(-6, -8, 12, 4);
        // Smile
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#111';
        ctx.beginPath();
        ctx.arc(0, 6, 10, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
    } else if (skinType === 'red-angry') {
        // Angry Eyebrows & Eyes 😡
        ctx.fillStyle = '#111';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#111';
        ctx.beginPath(); ctx.moveTo(-20, -16); ctx.lineTo(-4, -8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(20, -16); ctx.lineTo(4, -8); ctx.stroke();
        ctx.fillRect(-18, -6, 10, 10);
        ctx.fillRect(8, -6, 10, 10);
        // Mouth
        ctx.beginPath(); ctx.arc(0, 16, 12, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    } else if (skinType === 'ninja') {
        // Ninja Slit 🥷
        ctx.fillStyle = '#ffcc80';
        ctx.fillRect(-24, -14, 48, 16);
        ctx.fillStyle = '#111';
        ctx.fillRect(-14, -10, 8, 8);
        ctx.fillRect(6, -10, 8, 8);
    } else if (skinType === 'robot') {
        // Visor 🤖
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(-22, -14, 44, 16);
        ctx.fillStyle = '#111';
        ctx.fillRect(-14, -10, 8, 8);
        ctx.fillRect(6, -10, 8, 8);
        ctx.fillStyle = '#37474F';
        ctx.fillRect(-14, 8, 28, 8);
    } else if (skinType === 'gold') {
        // Crown Gold 👑
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(-16, -10, 10, 10);
        ctx.fillRect(6, -10, 10, 10);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#3e2723';
        ctx.beginPath(); ctx.arc(0, 8, 10, 0, Math.PI); ctx.stroke();
    } else {
        // Classic Roblox Face (Matching screenshot!)
        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-20, -14, 14, 14);
        ctx.fillRect(6, -14, 14, 14);
        ctx.fillStyle = '#111';
        ctx.fillRect(-16, -10, 7, 7);
        ctx.fillRect(10, -10, 7, 7);
        // Neutral Mouth Line
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#111';
        ctx.beginPath();
        ctx.moveTo(-12, 10);
        ctx.lineTo(12, 10);
        ctx.stroke();
    }

    ctx.restore();
}

// 2D Floating Name and Score Labels directly rendered above cubes!
function drawFloatingLabel2D(x, y, radius, name, score, isPlayer) {
    ctx.save();
    ctx.translate(x, y - radius - 16);

    ctx.textAlign = 'center';
    
    // Top Score Number
    ctx.font = `900 ${isPlayer ? 22 : 18}px "Nunito", sans-serif`;
    ctx.fillStyle = isPlayer ? '#ffca28' : '#ff9800';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 5;
    ctx.strokeText(formatScore(score), 0, -16);
    ctx.fillText(formatScore(score), 0, -16);

    // Bottom Name Text
    ctx.font = `800 ${isPlayer ? 22 : 20}px "Fredoka", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 5;
    ctx.strokeText(name, 0, 6);
    ctx.fillText(name, 0, 6);

    ctx.restore();
}

// --- CONTROLS & EVENT LISTENERS ---
function setupEventListeners() {
    window.addEventListener('pointermove', (e) => {
        initAudio();
        mousePos.x = e.clientX;
        mousePos.y = e.clientY;
    });

    window.addEventListener('pointerdown', () => {
        isPointerDown = true;
        initAudio();
    });

    window.addEventListener('pointerup', () => {
        isPointerDown = false;
    });

    window.addEventListener('keydown', (e) => {
        initAudio();
        if (['w','W','ArrowUp'].includes(e.key)) inputVector.y = -1;
        if (['s','S','ArrowDown'].includes(e.key)) inputVector.y = 1;
        if (['a','A','ArrowLeft'].includes(e.key)) inputVector.x = -1;
        if (['d','D','ArrowRight'].includes(e.key)) inputVector.x = 1;
        if (e.key === ' ') triggerSpeedBoost();
    });

    window.addEventListener('keyup', (e) => {
        if (['w','W','s','S','ArrowUp','ArrowDown'].includes(e.key)) inputVector.y = 0;
        if (['a','A','d','D','ArrowLeft','ArrowRight'].includes(e.key)) inputVector.x = 0;
    });

    elBtnAuto.addEventListener('click', toggleAutoMode);
    elBtnSpeedBoost.addEventListener('click', triggerSpeedBoost);
}

function toggleAutoMode() {
    gameState.isAuto = !gameState.isAuto;
    if (gameState.isAuto) elBtnAuto.classList.add('auto-active');
    else elBtnAuto.classList.remove('auto-active');
    playSound('eatFood');
}

function triggerSpeedBoost() {
    if (Date.now() < gameState.boostEndTime) return;
    gameState.speedMultiplier = 2.2;
    gameState.boostEndTime = Date.now() + 15000;
    elBtnSpeedBoost.classList.add('active-boost');
    playSound('boost');

    setTimeout(() => {
        gameState.speedMultiplier = 1.0;
        elBtnSpeedBoost.classList.remove('active-boost');
    }, 15000);
}

// --- TOUCH JOYSTICK ---
function setupJoystick() {
    const zone = document.getElementById('joystick-zone');
    const thumb = document.getElementById('joystick-thumb');
    
    if ('ontouchstart' in window) zone.style.display = 'block';

    let active = false;
    let startX = 0, startY = 0;

    zone.addEventListener('touchstart', (e) => {
        active = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
    });

    zone.addEventListener('touchmove', (e) => {
        if (!active) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const dist = Math.min(Math.hypot(dx, dy), 40);
        const angle = Math.atan2(dy, dx);

        thumb.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;

        inputVector.x = dx / 40;
        inputVector.y = dy / 40;
    });

    const endJoystick = () => {
        active = false;
        thumb.style.transform = 'translate(0px, 0px)';
        inputVector.x = 0;
        inputVector.y = 0;
    };

    zone.addEventListener('touchend', endJoystick);
    zone.addEventListener('touchcancel', endJoystick);
}

// --- UI UPDATES ---
let _uiThrottleTimer2D = 0;
function updateUI() {
    elScoreCount.textContent = formatScore(gameState.score);
    elWinsCount.textContent = gameState.wins;

    _uiThrottleTimer2D++;
    if (_uiThrottleTimer2D % 12 !== 0) return;

    const allPlayers = [
        { name: gameState.name, score: gameState.score, isPlayer: true },
        ...botsList.map(b => ({ name: b.name, score: b.score, isPlayer: false }))
    ];

    allPlayers.sort((a, b) => b.score - a.score);
    gameState.rank = allPlayers.findIndex(p => p.isPlayer) + 1;

    const top5 = allPlayers.slice(0, 5);
    elLeaderboardPanel.innerHTML = top5.map((entry, idx) => `
        <div class="leaderboard-row ${entry.isPlayer ? 'active-player' : ''}">
            <span class="rank-num">${idx + 1}.</span> 
            <span class="rank-name">${entry.name}</span>
        </div>
    `).join('');
}

function triggerGameOver() {
    gameState.isGameOver = true;
    playSound('gameover');

    elFinalScore.textContent = formatScore(gameState.score);
    elFinalRank.textContent = `#${gameState.rank}`;
    elGameOverModal.classList.remove('hidden');
}

function resetGame() {
    gameState.score = 0;
    gameState.isGameOver = false;
    resetPlayer();

    // 100% Fair reset for all bots as well!
    botsList.forEach(bot => {
        const pos = getRandomPos();
        bot.x = pos.x;
        bot.y = pos.y;
        bot.score = 0;
    });

    elGameOverModal.classList.add('hidden');
}

// --- MODALS & SKIN SETUP ---
function setupModals() {
    document.getElementById('btn-skins').addEventListener('click', () => {
        elSkinsModal.classList.remove('hidden');
    });

    document.querySelectorAll('.skin-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.skin-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            gameState.skin = item.getAttribute('data-skin');
        });
    });

    document.getElementById('btn-equip-skin').addEventListener('click', () => {
        elSkinsModal.classList.add('hidden');
    });

    document.getElementById('btn-wheel').addEventListener('click', () => {
        elWheelModal.classList.remove('hidden');
    });

    let isSpinning = false;
    document.getElementById('btn-spin-wheel').addEventListener('click', () => {
        if (isSpinning) return;
        isSpinning = true;
        playSound('spin');

        const spinner = document.getElementById('wheel-spinner');
        const randomRot = 1440 + Math.floor(Math.random() * 360);
        spinner.style.transform = `rotate(${randomRot}deg)`;

        setTimeout(() => {
            isSpinning = false;
            gameState.score += 250;
            playSound('eatBot');
            alert('🎉 Поздравляем! Вы выиграли +250 Очков!');
            elWheelModal.classList.add('hidden');
            spinner.style.transform = 'rotate(0deg)';
        }, 4200);
    });

    document.getElementById('btn-gift').addEventListener('click', () => {
        elGiftModal.classList.remove('hidden');
    });

    document.getElementById('btn-claim-gift').addEventListener('click', () => {
        gameState.score += 250;
        playSound('eatBot');
        elGiftModal.classList.add('hidden');
    });

    document.getElementById('btn-exit').addEventListener('click', () => {
        if (confirm('Вы действительно хотите выйти из игры?')) {
            resetGame();
        }
    });

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-backdrop').classList.add('hidden');
        });
    });

    document.getElementById('btn-respawn').addEventListener('click', resetGame);
}
