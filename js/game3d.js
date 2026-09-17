// EatsKubik 3D - Ultra Turbo 144+ FPS Engine & Mobile / Desktop IO Game
// Fully Optimized with Zero Garbage-Collection & Hardware Acceleration

if (typeof THREE === 'undefined') {
    console.error('Three.js not loaded!');
}

// --- GAME CONSTANTS & STATE ---
const MAP_SIZE = 280;
const MAX_FOOD = 160;
const BOTS_COUNT = 16;
const MAX_CRATES = 4;

let gameState = {
    score: 0,
    wins: 0,
    name: 'blo2587',
    skin: 'default',
    isAuto: false,
    speedMultiplier: 1.0,
    boostEndTime: 0,
    isGameOver: false,
    rank: 1,
    isMusicPlaying: false,
    isTurboLowSpec: true, // Default to true for max 60-144 FPS smoothness!

    // Power-up Buffs
    activeBuff: null, // 'magnet', 'shield', 'boost'
    buffEndTime: 0,

    // Food Combos
    comboCount: 0,
    lastEatTime: 0
};

// Colors palette
const CUBE_COLORS = [
    0x1e88e5, // Blue (Default)
    0x43a047, // Green
    0xe53935, // Red
    0xfdd835, // Yellow
    0x8e24aa, // Purple
    0x00acc1, // Cyan
    0xf57c00, // Orange
    0xd81b60  // Pink
];

const BOT_NAMES = [
    'Nathan', 'G3N3R4LZ', 'vortexP8', 'n0va5', 'Oliver', 
    'Michael', 'Sarah', 'Alex_99', 'ShadowCube', 'Maximus',
    'PixelKing', 'MegaBox', 'TurboCube', 'HyperX', 'Vortex_1',
    'CyberBot', 'Speedy', 'Titan', 'MegaCube', 'UltraX'
];

// --- THREE.JS ENGINE SETUP ---
let scene, camera, renderer, dirLight;
let playerMesh, playerRingMesh, playerShieldMesh;
let leaderCrownMesh;
let foodGroup, cratesGroup, botsList = [], projectilesList = [];
let audioCtx = null, musicInterval = null;

// Reusable Vector Pool (ZERO GARBAGE COLLECTION)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _labelProjVec = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _rayPlaneHit = new THREE.Vector3();

// Movement & Inputs
let targetPointerPos = new THREE.Vector3(0, 0, -10);
let inputVector = new THREE.Vector2(0, 0);
let playerForwardDir = new THREE.Vector3(0, 0, -1);
let raycaster = new THREE.Raycaster();
let mouseVec = new THREE.Vector2();
let groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let rawPointerX = window.innerWidth / 2;
let rawPointerY = window.innerHeight * 0.35;
let isPointerDown = false;
let isJoystickActive = false;
let touchStartX = 0, touchStartY = 0;
let activeTouchId = null;
const keysDown = {};

// FPS Counter tracking
let frameCount = 0;
let fpsCounter = 0;
let lastFpsTime = performance.now();
let measuredFps = 60;

// UI References (Guarded with fallback elements)
const elWinsCount = document.getElementById('wins-count');
const elScoreCount = document.getElementById('score-count');
const elFloatingContainer = document.getElementById('floating-labels-container');
const elLeaderboardPanel = document.getElementById('leaderboard-panel');
const elFpsNum = document.getElementById('fps-num');
const elActiveBuff = document.getElementById('active-buff-indicator');
const elBuffIcon = document.getElementById('buff-icon');
const elBuffText = document.getElementById('buff-text');

const elBtnAuto = document.getElementById('btn-auto');
const elBtnShoot = document.getElementById('btn-shoot');
const elBtnMusic = document.getElementById('btn-music');
const elBtnQuality = document.getElementById('btn-quality');
const elBtnSpeedBoost = document.getElementById('btn-speed-boost');

const elSkinsModal = document.getElementById('skins-modal');
const elWheelModal = document.getElementById('wheel-modal');
const elGiftModal = document.getElementById('gift-modal');
const elGameOverModal = document.getElementById('gameover-modal');
const elFinalScore = document.getElementById('final-score');
const elFinalRank = document.getElementById('final-rank');

// --- INITIAL LOAD ---
window.addEventListener('DOMContentLoaded', () => {
    initThreeScene();
    createCheckerboardFloor();
    createPlayer();
    createLeaderCrown();
    spawnFood();
    spawnMysteryCrates();
    spawnBots();
    setupEventListeners();
    setupModals();
    setupJoystick();
    applyQualitySettings();

    lastFrameTime = performance.now();
    requestAnimationFrame(animate);
});

// --- AUDIO SYSTEM (WITH RATE LIMITING) ---
let lastSoundTimes = {};

function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const nowMs = performance.now();
    // Limiter to prevent Web Audio buffer overload
    if (type === 'eatFood' && nowMs - (lastSoundTimes[type] || 0) < 45) return;
    lastSoundTimes[type] = nowMs;

    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'eatFood') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(980, now + 0.06);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.06);
            osc.start(now);
            osc.stop(now + 0.06);
        } else if (type === 'shoot') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(650, now);
            osc.frequency.exponentialRampToValueAtTime(250, now + 0.1);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'eatBot' || type === 'powerup') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(900, now + 0.18);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.18);
            osc.start(now);
            osc.stop(now + 0.18);
        } else if (type === 'boost') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'spin') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(700, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.04);
            osc.start(now);
            osc.stop(now + 0.04);
        } else if (type === 'gameover') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.linearRampToValueAtTime(120, now + 0.5);
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        }
    } catch(e) {}
}

function toggleMusic() {
    initAudio();
    gameState.isMusicPlaying = !gameState.isMusicPlaying;

    if (gameState.isMusicPlaying) {
        if (elBtnMusic) elBtnMusic.classList.add('playing');
        startMusicLoop();
    } else {
        if (elBtnMusic) elBtnMusic.classList.remove('playing');
        stopMusicLoop();
    }
}

const MELODY_NOTES = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 523.25];
let noteStep = 0;

function startMusicLoop() {
    if (musicInterval) clearInterval(musicInterval);
    
    musicInterval = setInterval(() => {
        if (!gameState.isMusicPlaying || !audioCtx) return;

        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            const freq = MELODY_NOTES[noteStep % MELODY_NOTES.length] * (noteStep % 4 === 0 ? 0.5 : 1);
            osc.type = noteStep % 2 === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

            osc.start(now);
            osc.stop(now + 0.16);

            noteStep++;
        } catch(e) {}
    }, 180);
}

function stopMusicLoop() {
    if (musicInterval) {
        clearInterval(musicInterval);
        musicInterval = null;
    }
}

// --- TURBO LOW-SPEC HARDWARE ACCELERATION ---
function toggleQualityMode() {
    gameState.isTurboLowSpec = !gameState.isTurboLowSpec;
    applyQualitySettings();
    showGameAlert(gameState.isTurboLowSpec ? "⚡ TURBO REJIM: 144 FPS!" : "✨ STANDART GRAFIKA", "#00e5ff");
}

function applyQualitySettings() {
    if (!renderer) return;

    if (gameState.isTurboLowSpec) {
        if (elBtnQuality) elBtnQuality.classList.add('turbo-mode');
        renderer.shadowMap.enabled = false;
        renderer.setPixelRatio(1.0); // Exact 1:1 pixels for zero GPU fillrate bottlenecks
        if (dirLight) dirLight.castShadow = false;
    } else {
        if (elBtnQuality) elBtnQuality.classList.remove('turbo-mode');
        renderer.shadowMap.enabled = false;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1.0, 1.25));
    }
}

// --- THREE.JS SCENE INITIALIZATION ---
function initThreeScene() {
    const canvas = document.getElementById('game-canvas');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7bc0ff);
    scene.fog = new THREE.FogExp2(0x7bc0ff, 0.007);

    camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 800);
    camera.position.set(0, 18, 22);

    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: false, 
        powerPreference: "high-performance",
        depth: true,
        stencil: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(1.0);
    renderer.shadowMap.enabled = false;

    // Optimized Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(50, 90, 50);
    dirLight.castShadow = false;
    scene.add(dirLight);

    window.addEventListener('resize', onWindowResize, { passive: true });
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- CHECKERBOARD FLOOR GRID ---
function createCheckerboardFloor() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#d0e6f7';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#e6f2fc';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillRect(32, 32, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    const repeats = MAP_SIZE / 4;
    texture.repeat.set(repeats, repeats);
    texture.magFilter = THREE.NearestFilter;

    const floorGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const floorMat = new THREE.MeshLambertMaterial({ map: texture });

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.matrixAutoUpdate = false;
    floor.updateMatrix();
    scene.add(floor);
}

// --- SKIN TEXTURE GENERATOR ---
function createFaceTexture(skinType = 'default', baseColor = '#1e88e5') {
    const canvas = document.createElement('canvas');
    canvas.width = 128; // 128x128 is ultra fast to upload and uses almost zero VRAM
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = '#111111';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    if (skinType === 'yellow-cool') {
        ctx.fillStyle = '#ffca28';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#111';
        ctx.fillRect(12, 38, 45, 30);
        ctx.fillRect(71, 38, 45, 30);
        ctx.beginPath();
        ctx.moveTo(57, 45); ctx.lineTo(71, 45); ctx.stroke();
        ctx.beginPath();
        ctx.arc(64, 88, 20, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
    } else if (skinType === 'red-angry') {
        ctx.fillStyle = '#ef5350';
        ctx.fillRect(0, 0, 128, 128);
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(15, 30); ctx.lineTo(50, 48); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(113, 30); ctx.lineTo(78, 48); ctx.stroke();
        ctx.fillRect(22, 52, 20, 18);
        ctx.fillRect(86, 52, 20, 18);
        ctx.beginPath();
        ctx.arc(64, 102, 22, 1.15 * Math.PI, 1.85 * Math.PI);
        ctx.stroke();
    } else if (skinType === 'ninja') {
        ctx.fillStyle = '#37474F';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#ffcc80';
        ctx.fillRect(15, 35, 98, 32);
        ctx.fillStyle = '#111';
        ctx.fillRect(27, 42, 15, 18);
        ctx.fillRect(86, 42, 15, 18);
    } else if (skinType === 'robot') {
        ctx.fillStyle = '#26c6da';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(15, 32, 98, 30);
        ctx.fillStyle = '#111';
        ctx.fillRect(25, 38, 22, 20);
        ctx.fillRect(81, 38, 22, 20);
        ctx.fillStyle = '#37474F';
        ctx.fillRect(30, 85, 68, 20);
    } else if (skinType === 'gold') {
        ctx.fillStyle = '#ffb300';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(25, 45, 20, 20);
        ctx.fillRect(83, 45, 20, 20);
        ctx.beginPath();
        ctx.arc(64, 85, 20, 0, Math.PI);
        ctx.stroke();
    } else {
        ctx.fillStyle = '#1e88e5';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(22, 40, 25, 25);
        ctx.fillRect(81, 40, 25, 25);
        ctx.fillStyle = '#111';
        ctx.fillRect(30, 48, 12, 12);
        ctx.fillRect(88, 48, 12, 12);
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(35, 92);
        ctx.lineTo(93, 92);
        ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
}

// --- CREATE PLAYER CUBE ---
function createPlayer() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const faceTex = createFaceTexture('default', '#1e88e5');
    const sideMat = new THREE.MeshLambertMaterial({ color: 0x1e88e5 });
    const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });

    const materials = [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat];

    playerMesh = new THREE.Mesh(geo, materials);
    playerMesh.position.set(0, 0.5, 0);
    scene.add(playerMesh);

    createPlayerTargetRing();
    createPlayerShield();
}

function createPlayerTargetRing() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.setLineDash([20, 16]);
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.stroke();

    const ringTex = new THREE.CanvasTexture(canvas);
    const ringGeo = new THREE.PlaneGeometry(2.2, 2.2);
    const ringMat = new THREE.MeshBasicMaterial({
        map: ringTex,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
    });

    playerRingMesh = new THREE.Mesh(ringGeo, ringMat);
    playerRingMesh.rotation.x = -Math.PI / 2;
    playerRingMesh.position.set(0, 0.02, 0);
    scene.add(playerRingMesh);
}

function createPlayerShield() {
    const shieldGeo = new THREE.SphereGeometry(1, 12, 8);
    const shieldMat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.45,
        wireframe: true
    });
    playerShieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    playerShieldMesh.visible = false;
    scene.add(playerShieldMesh);
}

// --- 3D FLOATING GOLDEN CROWN FOR #1 LEADER ---
function createLeaderCrown() {
    const crownGroup = new THREE.Group();
    const crownMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });

    const baseGeo = new THREE.CylinderGeometry(0.5, 0.45, 0.25, 8);
    const baseMesh = new THREE.Mesh(baseGeo, crownMat);
    crownGroup.add(baseMesh);

    // 4 spikes
    for (let i = 0; i < 4; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.12, 0.35, 4);
        const spike = new THREE.Mesh(spikeGeo, crownMat);
        const angle = (i / 4) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.42, 0.25, Math.sin(angle) * 0.42);
        crownGroup.add(spike);
    }

    crownGroup.scale.set(0.9, 0.9, 0.9);
    crownGroup.visible = true;
    scene.add(crownGroup);
    leaderCrownMesh = crownGroup;
}

// --- BIG & EXCITING FOOD ASSETS & MATERIALS ---
const normalGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
const megaGeo = new THREE.BoxGeometry(1.35, 1.35, 1.35);
const speedGeo = new THREE.BoxGeometry(1.05, 1.05, 1.05);
const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
const cyanMat = new THREE.MeshLambertMaterial({ color: 0x00e5ff });
const foodMatsCache = CUBE_COLORS.map(c => new THREE.MeshLambertMaterial({ color: c }));

// --- COMBAT BLAST CANNON ("OTISH" - SMART AIM & COMBAT SYSTEM) ---
const projectileGeo = new THREE.SphereGeometry(0.55, 10, 8);
const projectileMat = new THREE.MeshBasicMaterial({ color: 0xffee00 });
const projectileGlowMat = new THREE.MeshBasicMaterial({ color: 0xff6d00, wireframe: true, transparent: true, opacity: 0.6 });
let lastShootTime = 0;

// Smart Aim: calculates optimal shooting vector (Cursor / Joystick / Auto-Lock / Facing)
function getShootingDirection(preferClientPos = null) {
    const dir = new THREE.Vector3();

    // 1. If explicit screen position provided (Right-click or mouse event)
    if (preferClientPos && camera && playerMesh) {
        mouseVec.x = (preferClientPos.x / window.innerWidth) * 2 - 1;
        mouseVec.y = -(preferClientPos.y / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouseVec, camera);
        if (raycaster.ray.intersectPlane(groundPlane, _rayPlaneHit)) {
            dir.subVectors(_rayPlaneHit, playerMesh.position);
            dir.y = 0;
            if (dir.lengthSq() > 0.05) return dir.normalize();
        }
    }

    // 2. If mobile virtual joystick is active
    if (isJoystickActive && inputVector.lengthSq() > 0.05) {
        dir.set(inputVector.x, 0, inputVector.y).normalize();
        dir.y = 0;
        return dir;
    }

    // 3. Mouse pointer aiming on 3D ground plane
    if (camera && playerMesh && (rawPointerX !== window.innerWidth / 2 || rawPointerY !== window.innerHeight * 0.35)) {
        mouseVec.x = (rawPointerX / window.innerWidth) * 2 - 1;
        mouseVec.y = -(rawPointerY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouseVec, camera);
        if (raycaster.ray.intersectPlane(groundPlane, _rayPlaneHit)) {
            dir.subVectors(_rayPlaneHit, playerMesh.position);
            dir.y = 0;
            if (dir.lengthSq() > 0.1) return dir.normalize();
        }
    }

    // 4. Smart Auto-Aim Assist: target nearest enemy bot within 55 units!
    if (playerMesh && botsList.length > 0) {
        let closestBot = null;
        let closestDistSq = 55 * 55;
        for (let i = 0; i < botsList.length; i++) {
            const b = botsList[i];
            if (!b.mesh) continue;
            const dSq = playerMesh.position.distanceToSquared(b.mesh.position);
            if (dSq < closestDistSq) {
                closestDistSq = dSq;
                closestBot = b;
            }
        }
        if (closestBot) {
            dir.subVectors(closestBot.mesh.position, playerMesh.position);
            dir.y = 0;
            return dir.normalize();
        }
    }

    // 5. Fallback to player forward movement direction
    if (playerForwardDir && playerForwardDir.lengthSq() > 0.01) {
        dir.copy(playerForwardDir).normalize();
        dir.y = 0;
        return dir;
    }

    return new THREE.Vector3(0, 0, -1);
}

function shootMass(preferClientPos = null) {
    if (!playerMesh || gameState.isGameOver) return;
    const nowMs = performance.now();
    if (nowMs - lastShootTime < 180) return; // 180ms rapid fire
    lastShootTime = nowMs;

    playSound('shoot');

    const playerScale = getScaleForScore(gameState.score);
    const shootDir = getShootingDirection(preferClientPos);

    // Create glowing plasma energy projectile
    const proj = new THREE.Mesh(projectileGeo, projectileMat);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.78, 8, 6), projectileGlowMat);
    proj.add(glow);

    // Spawn ahead of player cube
    proj.position.copy(playerMesh.position);
    proj.position.addScaledVector(shootDir, (playerScale * 0.5) + 0.85);
    proj.position.y = Math.max(0.48, playerScale * 0.35);

    const velocity = shootDir.clone().multiplyScalar(48); // 48 u/s fast bolt

    scene.add(proj);
    projectilesList.push({
        mesh: proj,
        velocity: velocity,
        dir: shootDir.clone(),
        lifeTime: 1.2
    });

    // Animate button feedback on screen
    const mobileShootBtn = document.getElementById('btn-mobile-shoot');
    if (mobileShootBtn) {
        mobileShootBtn.style.transform = 'scale(0.85)';
        setTimeout(() => { mobileShootBtn.style.transform = ''; }, 100);
    }
    const desktopShootBtn = document.getElementById('btn-shoot');
    if (desktopShootBtn) {
        desktopShootBtn.style.transform = 'scale(0.88)';
        setTimeout(() => { desktopShootBtn.style.transform = ''; }, 100);
    }
}

function updateProjectiles(dt) {
    const substeps = 2;
    const subDt = dt / substeps;

    for (let i = projectilesList.length - 1; i >= 0; i--) {
        const p = projectilesList[i];
        let hit = false;

        // Anti-tunneling 2 sub-steps per frame
        for (let s = 0; s < substeps; s++) {
            p.mesh.position.addScaledVector(p.velocity, subDt);
            p.mesh.rotation.y += 0.14;
            p.mesh.rotation.x += 0.14;

            const px = p.mesh.position.x;
            const pz = p.mesh.position.z;

            // 1. Check Collision with Bots
            for (let b = 0; b < botsList.length; b++) {
                const bot = botsList[b];
                if (!bot.mesh) continue;
                const bScale = getScaleForScore(bot.score);
                const bRad = bScale * 0.6;
                const dx = px - bot.mesh.position.x;
                const dz = pz - bot.mesh.position.z;

                const hitDist = bRad + 0.85;
                if (dx * dx + dz * dz < hitDist * hitDist) {
                    hit = true;
                    playSound('eatBot');
                    showGameAlert(`💥 ${bot.name}GA ZARBA! +15`, '#00e5ff');
                    gameState.score += 15;

                    // Knock bot backwards
                    bot.mesh.position.addScaledVector(p.dir, 4.5);
                    const maxB = (MAP_SIZE / 2) - 2;
                    bot.mesh.position.x = Math.max(-maxB, Math.min(maxB, bot.mesh.position.x));
                    bot.mesh.position.z = Math.max(-maxB, Math.min(maxB, bot.mesh.position.z));

                    bot.score = Math.max(0, bot.score - 10);
                    updateCubeScale(bot.mesh, bot.score);

                    // Drop 2 gold food pellets around bot
                    if (foodGroup) {
                        for (let f = 0; f < 2; f++) {
                            const dropFood = new THREE.Mesh(normalGeo, goldMat);
                            dropFood.position.set(
                                bot.mesh.position.x + (Math.random() - 0.5) * 2.8,
                                0.42,
                                bot.mesh.position.z + (Math.random() - 0.5) * 2.8
                            );
                            dropFood.userData = { type: 'mega', value: 6, initialY: 0.42 };
                            dropFood.matrixAutoUpdate = false;
                            dropFood.updateMatrix();
                            foodGroup.add(dropFood);
                        }
                    }
                    break;
                }
            }

            if (hit) break;
        }

        p.lifeTime -= dt;

        // 2. If lifetime expired or hit bot, remove projectile
        if (hit || p.lifeTime <= 0) {
            if (!hit && foodGroup && foodGroup.children.length < MAX_FOOD + 20) {
                const drop = new THREE.Mesh(normalGeo, cyanMat);
                drop.position.set(p.mesh.position.x, 0.42, p.mesh.position.z);
                drop.userData = { type: 'normal', value: 3, initialY: 0.42 };
                drop.matrixAutoUpdate = false;
                drop.updateMatrix();
                foodGroup.add(drop);
            }

            scene.remove(p.mesh);
            projectilesList.splice(i, 1);
        }
    }
}

// --- FLOATING POPUP ALERT & COMBO TEXT ---
function showGameAlert(text, color = '#ffd700') {
    const overlay = document.getElementById('ui-overlay');
    if (!overlay) return;
    const el = document.createElement('div');
    el.className = 'game-alert-banner';
    el.style.color = color;
    el.textContent = text;
    overlay.appendChild(el);
    setTimeout(() => { el.remove(); }, 1400);
}

function showComboPopup(combo) {
    const overlay = document.getElementById('ui-overlay');
    if (!overlay) return;
    const el = document.createElement('div');
    el.className = 'combo-popup-text';
    el.style.left = `${50 + (Math.random() * 20 - 10)}%`;
    el.style.top = `${38 + (Math.random() * 10 - 5)}%`;
    el.textContent = `🔥 COMBO X${combo}!`;
    overlay.appendChild(el);
    setTimeout(() => { el.remove(); }, 1100);
}

function spawnFood() {
    foodGroup = new THREE.Group();

    for (let i = 0; i < MAX_FOOD; i++) {
        let food;
        const roll = Math.random();

        if (roll < 0.12) {
            // Mega Gold Food (12%) -> +8 score
            food = new THREE.Mesh(megaGeo, goldMat);
            food.userData = { type: 'mega', value: 8, initialY: 0.68 };
            food.position.y = 0.68;
        } else if (roll < 0.24) {
            // Speed Crystal (12%) -> +4 score & 2x speed burst
            food = new THREE.Mesh(speedGeo, cyanMat);
            food.userData = { type: 'speed', value: 4, initialY: 0.52 };
            food.position.y = 0.52;
        } else {
            // Normal Food (76%) -> +2 score
            const mat = foodMatsCache[Math.floor(Math.random() * foodMatsCache.length)];
            food = new THREE.Mesh(normalGeo, mat);
            food.userData = { type: 'normal', value: 2, initialY: 0.42 };
            food.position.y = 0.42;
        }
        
        const pos = getRandomPosition(MAP_SIZE - 20);
        food.position.x = pos.x;
        food.position.z = pos.z;
        food.rotation.set(0, Math.random() * Math.PI, 0);

        // FREEZE MATRICES: Three.js will skip matrix computations for static food!
        food.matrixAutoUpdate = false;
        food.updateMatrix();

        foodGroup.add(food);
    }
    scene.add(foodGroup);
}

// --- 🎁 3D MYSTERY CRATES (POWER-UP BOXES) ---
const crateGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const crateMat = new THREE.MeshLambertMaterial({ color: 0xff9800 });

function spawnMysteryCrates() {
    cratesGroup = new THREE.Group();

    for (let i = 0; i < MAX_CRATES; i++) {
        const crate = new THREE.Mesh(crateGeo, crateMat);
        const pos = getRandomPosition(MAP_SIZE - 30);
        crate.position.set(pos.x, 0.8, pos.z);
        crate.userData = { initialY: 0.8 };
        cratesGroup.add(crate);
    }
    scene.add(cratesGroup);
}

function updateCratesAnimation() {
    if (!cratesGroup) return;
    const now = performance.now() * 0.003;
    const crates = cratesGroup.children;
    for (let i = 0; i < crates.length; i++) {
        const c = crates[i];
        c.rotation.y += 0.03;
        c.position.y = 0.8 + Math.sin(now + i) * 0.25;
    }
}

function triggerPowerup(buffType) {
    const now = performance.now();
    gameState.activeBuff = buffType;
    gameState.buffEndTime = now + 6500; // 6.5 seconds duration
    playSound('powerup');

    if (elActiveBuff) {
        elActiveBuff.style.display = 'flex';
        if (buffType === 'magnet') {
            if (elBuffIcon) elBuffIcon.textContent = '🧲';
            if (elBuffText) elBuffText.textContent = 'SUPER MAGNIT! (6s)';
            showGameAlert('🧲 SUPER MAGNIT FAOLLASHDI!', '#ffea00');
        } else if (buffType === 'shield') {
            if (elBuffIcon) elBuffIcon.textContent = '🛡️';
            if (elBuffText) elBuffText.textContent = 'OLTIN QALQON! (6s)';
            if (playerShieldMesh) playerShieldMesh.visible = true;
            showGameAlert('🛡️ OLTIN QALQON HIMOYASI!', '#ffd700');
        } else if (buffType === 'boost') {
            if (elBuffIcon) elBuffIcon.textContent = '🚀';
            if (elBuffText) elBuffText.textContent = 'RAKETA TEZLIK! (6s)';
            gameState.speedMultiplier = 3.2;
            showGameAlert('🚀 RAKETA 3.2X TEZLIK!', '#ff5722');
        }
    }
}

function updateBuffs() {
    if (!gameState.activeBuff) return;
    const now = performance.now();

    if (now > gameState.buffEndTime) {
        // Buff expired
        if (gameState.activeBuff === 'shield' && playerShieldMesh) {
            playerShieldMesh.visible = false;
        }
        if (gameState.activeBuff === 'boost') {
            gameState.speedMultiplier = 1.0;
        }
        gameState.activeBuff = null;
        if (elActiveBuff) elActiveBuff.style.display = 'none';
    } else {
        // Update remaining seconds display
        const remaining = Math.ceil((gameState.buffEndTime - now) / 1000);
        if (elBuffText) {
            if (gameState.activeBuff === 'magnet') elBuffText.textContent = `SUPER MAGNIT (${remaining}s)`;
            if (gameState.activeBuff === 'shield') elBuffText.textContent = `OLTIN QALQON (${remaining}s)`;
            if (gameState.activeBuff === 'boost') elBuffText.textContent = `RAKETA TEZLIK (${remaining}s)`;
        }
        // Rotate shield visual
        if (gameState.activeBuff === 'shield' && playerShieldMesh && playerMesh) {
            playerShieldMesh.position.copy(playerMesh.position);
            playerShieldMesh.rotation.y += 0.04;
            const sScale = playerMesh.scale.x * 1.5;
            playerShieldMesh.scale.set(sScale, sScale, sScale);
        }
    }
}

// --- 100% FAIR BOTS MANAGER (EVERYONE STARTS AT SCORE 0!) ---
const botGeo = new THREE.BoxGeometry(1, 1, 1);

function spawnBots() {
    for (let i = 0; i < BOTS_COUNT; i++) {
        const botName = BOT_NAMES[i % BOT_NAMES.length];
        const color = CUBE_COLORS[i % CUBE_COLORS.length];
        const mat = new THREE.MeshLambertMaterial({ color: color });
        const botMesh = new THREE.Mesh(botGeo, mat);

        const pos = getRandomPosition(MAP_SIZE - 40);
        botMesh.position.set(pos.x, 0.5, pos.z);

        const botData = {
            id: i,
            mesh: botMesh,
            name: botName,
            score: 0, // 100% Fair start at 0
            targetPos: new THREE.Vector3(pos.x, 0, pos.z),
            targetDir: new THREE.Vector3(0, 0, 1),
            thinkCooldown: Math.floor(Math.random() * 15),
            domLabel: createFloatingLabel(botName, 0, false)
        };

        updateCubeScale(botData.mesh, 0);
        scene.add(botMesh);
        botsList.push(botData);
    }

    gameState.playerLabel = createFloatingLabel(gameState.name, gameState.score, true);
}

function getRandomPosition(radius) {
    return {
        x: (Math.random() - 0.5) * radius,
        z: (Math.random() - 0.5) * radius
    };
}

function getScaleForScore(score) {
    return 1.0 + Math.sqrt(score) * 0.26 + Math.log10(1 + score * 2) * 0.45;
}

function updateCubeScale(mesh, score) {
    const scale = getScaleForScore(score);
    mesh.scale.set(scale, scale, scale);
    mesh.position.y = scale / 2;
}

// --- ZERO-DOM-THRASHING FLOATING LABELS ---
function createFloatingLabel(name, score, isPlayer = false) {
    const div = document.createElement('div');
    div.className = `cube-floating-label ${isPlayer ? 'is-player' : ''}`;
    div.innerHTML = `
        <div class="cube-score">${formatScore(score)}</div>
        <div class="cube-name">${name}</div>
    `;
    if (elFloatingContainer) elFloatingContainer.appendChild(div);
    return {
        el: div,
        scoreEl: div.querySelector('.cube-score'),
        isPlayer: isPlayer,
        lastScore: -1,
        visible: true
    };
}

function formatScore(score) {
    if (score >= 1000) {
        return (score / 1000).toFixed(1).replace('.', ',') + 'K';
    }
    return score.toString();
}

function updateFloatingLabel(labelObj, position, name, score) {
    if (!labelObj || !playerMesh) return;

    // Fast Distance Culling (> 60 units = hidden)
    if (!labelObj.isPlayer) {
        const dx = position.x - playerMesh.position.x;
        const dz = position.z - playerMesh.position.z;
        if (dx * dx + dz * dz > 3600) {
            if (labelObj.visible) {
                labelObj.el.style.display = 'none';
                labelObj.visible = false;
            }
            return;
        }
    }

    _labelProjVec.copy(position);
    _labelProjVec.y += (getScaleForScore(score) * 0.5) + 1.2;
    _labelProjVec.project(camera);

    // Behind camera or out of bounds
    if (_labelProjVec.z > 1 || _labelProjVec.z < -1) {
        if (labelObj.visible) {
            labelObj.el.style.display = 'none';
            labelObj.visible = false;
        }
        return;
    }

    const x = Math.round((_labelProjVec.x * 0.5 + 0.5) * window.innerWidth);
    const y = Math.round((_labelProjVec.y * -0.5 + 0.5) * window.innerHeight);

    if (x < -60 || x > window.innerWidth + 60 || y < -60 || y > window.innerHeight + 60) {
        if (labelObj.visible) {
            labelObj.el.style.display = 'none';
            labelObj.visible = false;
        }
        return;
    }

    if (!labelObj.visible) {
        labelObj.el.style.display = 'flex';
        labelObj.visible = true;
    }

    // Direct GPU translate3d with zero CSS transition overhead!
    labelObj.el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%, -100%)`;
    
    if (labelObj.lastScore !== score) {
        labelObj.scoreEl.textContent = formatScore(score);
        labelObj.lastScore = score;
    }
}

// --- EVENT LISTENERS & MULTI-INPUT CONTROLLER ---
function setupEventListeners() {
    // 1. Right Click = Instant Cannon Shot at Cursor
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        initAudio();
        shootMass({ x: e.clientX, y: e.clientY });
    });

    window.addEventListener('pointerdown', (e) => {
        initAudio();
        // Right mouse button (button 2) -> Shoot
        if (e.button === 2) {
            shootMass({ x: e.clientX, y: e.clientY });
            return;
        }

        if (e.pointerType !== 'touch') {
            // Ignore clicks on UI buttons or modals
            if (e.target.closest('button') || e.target.closest('.modal-box') || e.target.closest('.header-circle-btn') || e.target.closest('.stat-card') || e.target.closest('.leaderboard-card')) {
                return;
            }
            isPointerDown = true;
            rawPointerX = e.clientX;
            rawPointerY = e.clientY;
        }
    });

    window.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'touch') {
            rawPointerX = e.clientX;
            rawPointerY = e.clientY;
        }
    }, { passive: true });

    window.addEventListener('pointerup', () => {
        isPointerDown = false;
    });

    window.addEventListener('pointercancel', () => {
        isPointerDown = false;
    });

    window.addEventListener('blur', () => {
        isPointerDown = false;
        isJoystickActive = false;
        for (const k in keysDown) keysDown[k] = false;
    });

    window.addEventListener('keydown', (e) => {
        initAudio();
        keysDown[e.key] = true;
        keysDown[e.key.toLowerCase()] = true;

        // Shoot Key: E, Q, F across English and Russian/Cyrillic (У, Й, А)
        const k = (e.key || '').toLowerCase();
        if (e.code === 'KeyE' || e.code === 'KeyQ' || e.code === 'KeyF' || 
            k === 'e' || k === 'у' || k === 'q' || k === 'й' || k === 'f' || k === 'а') {
            shootMass();
        }

        if (e.key === ' ' || e.code === 'Space') {
            triggerSpeedBoost();
        }
    });

    window.addEventListener('keyup', (e) => {
        keysDown[e.key] = false;
        keysDown[e.key.toLowerCase()] = false;
    });

    // Desktop UI Buttons
    if (elBtnAuto) elBtnAuto.addEventListener('click', toggleAutoMode);
    if (elBtnShoot) {
        const fireDesktop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            initAudio();
            shootMass();
        };
        elBtnShoot.addEventListener('click', fireDesktop);
        elBtnShoot.addEventListener('pointerdown', fireDesktop);
    }
    if (elBtnMusic) elBtnMusic.addEventListener('click', toggleMusic);
    if (elBtnQuality) elBtnQuality.addEventListener('click', toggleQualityMode);
    if (elBtnSpeedBoost) elBtnSpeedBoost.addEventListener('click', triggerSpeedBoost);

    // Mobile Action Buttons (Instant touchstart & pointerdown for multi-touch joystick combat)
    const btnMobileShoot = document.getElementById('btn-mobile-shoot');
    if (btnMobileShoot) {
        const fireMobile = (e) => {
            e.preventDefault();
            e.stopPropagation();
            initAudio();
            shootMass();
        };
        btnMobileShoot.addEventListener('touchstart', fireMobile, { passive: false });
        btnMobileShoot.addEventListener('pointerdown', fireMobile);
        btnMobileShoot.addEventListener('click', fireMobile);
    }

    const btnMobileBoost = document.getElementById('btn-mobile-boost');
    if (btnMobileBoost) {
        const boostMobile = (e) => {
            e.preventDefault();
            e.stopPropagation();
            initAudio();
            triggerSpeedBoost();
        };
        btnMobileBoost.addEventListener('touchstart', boostMobile, { passive: false });
        btnMobileBoost.addEventListener('pointerdown', boostMobile);
        btnMobileBoost.addEventListener('click', boostMobile);
    }

    const btnMobileAuto = document.getElementById('btn-mobile-auto');
    if (btnMobileAuto) {
        const autoMobile = (e) => {
            e.preventDefault();
            e.stopPropagation();
            initAudio();
            toggleAutoMode();
        };
        btnMobileAuto.addEventListener('touchstart', autoMobile, { passive: false });
        btnMobileAuto.addEventListener('pointerdown', autoMobile);
        btnMobileAuto.addEventListener('click', autoMobile);
    }
}

function toggleAutoMode() {
    gameState.isAuto = !gameState.isAuto;
    if (elBtnAuto) {
        if (gameState.isAuto) elBtnAuto.classList.add('auto-active');
        else elBtnAuto.classList.remove('auto-active');
    }
    const btnMobileAuto = document.getElementById('btn-mobile-auto');
    if (btnMobileAuto) {
        if (gameState.isAuto) btnMobileAuto.style.filter = 'brightness(1.4)';
        else btnMobileAuto.style.filter = 'none';
    }
    playSound('eatFood');
}

function triggerSpeedBoost() {
    if (Date.now() < gameState.boostEndTime) return;
    gameState.speedMultiplier = 3.5;
    gameState.boostEndTime = Date.now() + 15000;
    if (elBtnSpeedBoost) elBtnSpeedBoost.classList.add('active-boost');
    playSound('boost');

    setTimeout(() => {
        if (gameState.activeBuff !== 'boost') {
            gameState.speedMultiplier = 1.0;
        }
        if (elBtnSpeedBoost) elBtnSpeedBoost.classList.remove('active-boost');
    }, 15000);
}

// --- DYNAMIC TOUCH JOYSTICK FOR MOBILE & TABLETS ---
function setupJoystick() {
    const zone = document.getElementById('joystick-zone');
    const thumb = document.getElementById('joystick-thumb');
    const container = document.getElementById('game-container');
    if (!zone || !thumb || !container) return;

    // Show joystick by default on mobile / touch screens
    const isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
        zone.style.display = 'block';
    }

    container.addEventListener('touchstart', (e) => {
        initAudio();
        // Ignore touches on UI buttons or modals
        if (e.target.closest('button') || e.target.closest('.modal-box') || e.target.closest('.header-circle-btn')) {
            return;
        }

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.clientX < window.innerWidth * 0.65 && activeTouchId === null) {
                activeTouchId = touch.identifier;
                isJoystickActive = true;
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;

                // Center joystick right under thumb!
                zone.style.display = 'block';
                zone.style.left = (touchStartX - 70) + 'px';
                zone.style.top = (touchStartY - 70) + 'px';
                zone.style.bottom = 'auto';
                thumb.style.transform = 'translate3d(0, 0, 0)';
                inputVector.set(0, 0);
                break;
            }
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (!isJoystickActive) return;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === activeTouchId) {
                const dx = touch.clientX - touchStartX;
                const dy = touch.clientY - touchStartY;
                const dist = Math.min(Math.hypot(dx, dy), 45);
                const angle = Math.atan2(dy, dx);

                const tx = Math.cos(angle) * dist;
                const ty = Math.sin(angle) * dist;
                thumb.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;

                inputVector.x = tx / 45;
                inputVector.y = ty / 45;
                break;
            }
        }
    }, { passive: true });

    const endTouch = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
                activeTouchId = null;
                isJoystickActive = false;
                inputVector.set(0, 0);
                thumb.style.transform = 'translate3d(0, 0, 0)';
                zone.style.left = '30px';
                zone.style.bottom = '30px';
                zone.style.top = 'auto';
                break;
            }
        }
    };

    container.addEventListener('touchend', endTouch, { passive: true });
    container.addEventListener('touchcancel', endTouch, { passive: true });
}

// --- ULTRA OPTIMIZED GAME LOOP ---
let lastFrameTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.033);
    lastFrameTime = now;
    frameCount++;

    // Measure FPS
    fpsCounter++;
    if (now - lastFpsTime >= 500) {
        measuredFps = Math.round((fpsCounter * 1000) / (now - lastFpsTime));
        fpsCounter = 0;
        lastFpsTime = now;
        if (elFpsNum) elFpsNum.textContent = measuredFps;
    }

    // Update ground plane raycast continuously so aim and pointer tracking are always accurate
    if (camera) {
        mouseVec.x = (rawPointerX / window.innerWidth) * 2 - 1;
        mouseVec.y = -(rawPointerY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouseVec, camera);
        if (raycaster.ray.intersectPlane(groundPlane, _rayPlaneHit)) {
            targetPointerPos.copy(_rayPlaneHit);
        }
    }

    if (!gameState.isGameOver) {
        updatePlayerMovement(dt);
        updateBotsLogic(dt);
        updateProjectiles(dt);
        updateCratesAnimation();
        updateBuffs();
        checkCollisions();
        updateCamera();
        updateCrownLeader();
        updateUI();
    }

    renderer.render(scene, camera);
}

// --- PLAYER MOVEMENT (100% MANUAL: ONLY MOVES WHEN PLAYER GIVES ACTIVE INPUT) ---
function updatePlayerMovement(dt) {
    if (!playerMesh) return;

    _dir.set(0, 0, 0);
    const currentScale = getScaleForScore(gameState.score);
    const baseSpeed = 24.0 * (1 / Math.pow(currentScale, 0.2)) * gameState.speedMultiplier;

    // 1. Keyboard Controls (WASD / Arrow keys) - Instant response
    let kx = 0, kz = 0;
    if (keysDown.w || keysDown.W || keysDown.arrowup || keysDown.ArrowUp) kz -= 1;
    if (keysDown.s || keysDown.S || keysDown.arrowdown || keysDown.ArrowDown) kz += 1;
    if (keysDown.a || keysDown.A || keysDown.arrowleft || keysDown.ArrowLeft) kx -= 1;
    if (keysDown.d || keysDown.D || keysDown.arrowright || keysDown.ArrowRight) kx += 1;

    const isKeyboardActive = (kx !== 0 || kz !== 0);

    if (isKeyboardActive) {
        _dir.set(kx, 0, kz).normalize();
    }
    // 2. Mobile Virtual Joystick (Touch Active)
    else if (isJoystickActive && inputVector.lengthSq() > 0.02) {
        _dir.set(inputVector.x, 0, inputVector.y).normalize();
    }
    // 3. Mouse Click-and-Hold / Drag Control
    else if (isPointerDown) {
        const dx = targetPointerPos.x - playerMesh.position.x;
        const dz = targetPointerPos.z - playerMesh.position.z;
        const distSq = dx * dx + dz * dz;

        // Move towards cursor as long as mouse button is held down
        if (distSq > 0.4) {
            _dir.set(dx, 0, dz).normalize();
        }
    }
    // 4. Autopilot Mode ("Авто") - Only if user EXPLICITLY turned it on!
    else if (gameState.isAuto) {
        const target = findNearestTarget(playerMesh.position, gameState.score);
        if (target) {
            _dir.subVectors(target, playerMesh.position);
            _dir.y = 0;
            _dir.normalize();
        }
    }
    // 5. ZERO INPUT: PLAYER IS IDLE -> DO NOT MOVE!
    else {
        _dir.set(0, 0, 0);
    }

    // Apply movement ONLY if active input was provided
    if (_dir.lengthSq() > 0.001) {
        playerMesh.position.addScaledVector(_dir, baseSpeed * dt);
        playerForwardDir.copy(_dir);

        const maxBound = (MAP_SIZE / 2) - 2;
        playerMesh.position.x = THREE.MathUtils.clamp(playerMesh.position.x, -maxBound, maxBound);
        playerMesh.position.z = THREE.MathUtils.clamp(playerMesh.position.z, -maxBound, maxBound);

        const targetAngle = Math.atan2(_dir.x, _dir.z);
        playerMesh.rotation.y = THREE.MathUtils.lerp(playerMesh.rotation.y, targetAngle, 0.2);
    }

    if (playerRingMesh) {
        playerRingMesh.position.x = playerMesh.position.x;
        playerRingMesh.position.z = playerMesh.position.z;
        playerRingMesh.rotation.z += 0.02;
        const ringScale = currentScale * 1.5;
        playerRingMesh.scale.set(ringScale, ringScale, 1);
    }

    // Smoothly bounce & settle scale
    const targetScale = getScaleForScore(gameState.score);
    playerMesh.scale.x = THREE.MathUtils.lerp(playerMesh.scale.x, targetScale, 0.18);
    playerMesh.scale.y = THREE.MathUtils.lerp(playerMesh.scale.y, targetScale, 0.18);
    playerMesh.scale.z = THREE.MathUtils.lerp(playerMesh.scale.z, targetScale, 0.18);
    playerMesh.position.y = playerMesh.scale.y / 2;

    updateFloatingLabel(gameState.playerLabel, playerMesh.position, gameState.name, gameState.score);
}

// --- BOT AI (TIME-SLICED TO ELIMINATE 90% CPU LOAD) ---
function updateBotsLogic(dt) {
    const bLen = botsList.length;

    for (let i = 0; i < bLen; i++) {
        const bot = botsList[i];
        const botScale = getScaleForScore(bot.score);
        let speed = 20.0 * (1 / Math.pow(botScale, 0.2));

        bot.thinkCooldown--;

        // TIME-SLICED THINKING: Only re-evaluate target every 16 frames!
        if (bot.thinkCooldown <= 0) {
            bot.thinkCooldown = 16 + (i % 6);
            evaluateBotDecision(bot);
        }

        // Steer along target direction
        if (bot.targetDir.lengthSq() > 0.01) {
            bot.mesh.position.addScaledVector(bot.targetDir, speed * dt);

            const maxBound = (MAP_SIZE / 2) - 2;
            bot.mesh.position.x = THREE.MathUtils.clamp(bot.mesh.position.x, -maxBound, maxBound);
            bot.mesh.position.z = THREE.MathUtils.clamp(bot.mesh.position.z, -maxBound, maxBound);

            const targetAngle = Math.atan2(bot.targetDir.x, bot.targetDir.z);
            bot.mesh.rotation.y = THREE.MathUtils.lerp(bot.mesh.rotation.y, targetAngle, 0.18);
        }

        // Interleaved label updates (even bots on even frames, odd bots on odd frames)
        if ((frameCount + i) % 2 === 0) {
            updateFloatingLabel(bot.domLabel, bot.mesh.position, bot.name, bot.score);
        }
    }
}

function evaluateBotDecision(bot) {
    const bPos = bot.mesh.position;
    const bScore = bot.score;
    let flee = false;

    // 1. DANGER CHECK (Check player & bots)
    if (!gameState.isGameOver && gameState.score > bScore * 1.15 && gameState.activeBuff !== 'shield') {
        const dx = bPos.x - playerMesh.position.x;
        const dz = bPos.z - playerMesh.position.z;
        if (dx * dx + dz * dz < 1600) { // Within 40 units
            bot.targetDir.set(dx, 0, dz).normalize();
            flee = true;
        }
    }

    if (!flee) {
        // 2. HUNT PREY OR CLOSEST FOOD
        let bestTarget = null;
        let bestDistSq = 2500; // Search window 50 units

        // Check if smaller bots are nearby to hunt
        for (let j = 0; j < botsList.length; j++) {
            const other = botsList[j];
            if (other !== bot && bScore > other.score * 1.15) {
                const dx = other.mesh.position.x - bPos.x;
                const dz = other.mesh.position.z - bPos.z;
                const dSq = dx * dx + dz * dz;
                if (dSq < bestDistSq) {
                    bestDistSq = dSq;
                    _v1.set(other.mesh.position.x, 0, other.mesh.position.z);
                    bestTarget = _v1;
                }
            }
        }

        // If no prey nearby, pick closest food in a coarse sample
        if (!bestTarget && foodGroup) {
            const foods = foodGroup.children;
            const fCount = foods.length;
            // Check 25 nearby food samples
            const step = Math.max(1, Math.floor(fCount / 25));
            for (let k = 0; k < fCount; k += step) {
                const food = foods[k];
                const dx = food.position.x - bPos.x;
                const dz = food.position.z - bPos.z;
                const dSq = dx * dx + dz * dz;
                if (dSq < bestDistSq) {
                    bestDistSq = dSq;
                    _v1.set(food.position.x, 0, food.position.z);
                    bestTarget = _v1;
                }
            }
        }

        if (bestTarget) {
            bot.targetDir.subVectors(bestTarget, bPos).normalize();
            bot.targetDir.y = 0;
        } else {
            // Wander randomly
            const rnd = getRandomPosition(MAP_SIZE - 40);
            _v1.set(rnd.x, 0, rnd.z);
            bot.targetDir.subVectors(_v1, bPos).normalize();
            bot.targetDir.y = 0;
        }
    }
}

function findNearestTarget(pos, myScore) {
    let nearestDistSq = 99999;
    let target = null;

    if (foodGroup) {
        const foods = foodGroup.children;
        const count = foods.length;
        for (let i = 0; i < count; i += 4) {
            const f = foods[i];
            const dx = f.position.x - pos.x;
            const dz = f.position.z - pos.z;
            const dSq = dx * dx + dz * dz;
            if (dSq < nearestDistSq) {
                nearestDistSq = dSq;
                _v2.copy(f.position);
                target = _v2;
            }
        }
    }
    return target;
}

// --- 3D GOLDEN CROWN LOGIC ---
function updateCrownLeader() {
    if (!leaderCrownMesh) return;

    leaderCrownMesh.rotation.y += 0.03;

    // Find highest score cube
    let topScore = gameState.score;
    let topMesh = playerMesh;

    for (let i = 0; i < botsList.length; i++) {
        if (botsList[i].score > topScore) {
            topScore = botsList[i].score;
            topMesh = botsList[i].mesh;
        }
    }

    if (topMesh) {
        const topScale = topMesh.scale.x;
        leaderCrownMesh.position.x = topMesh.position.x;
        leaderCrownMesh.position.y = (topScale * 0.5) + 1.6 + Math.sin(performance.now() * 0.004) * 0.15;
        leaderCrownMesh.position.z = topMesh.position.z;
    }
}

// --- FAST COLLISION ENGINE (SQUARED DISTANCES + AABB) ---
function checkCollisions() {
    if (!playerMesh) return;

    const pScale = getScaleForScore(gameState.score);
    const pRadius = pScale * 0.55;
    const px = playerMesh.position.x;
    const pz = playerMesh.position.z;

    const isMagnetActive = (gameState.activeBuff === 'magnet');
    const eatDist = pRadius + 0.95;
    const eatDistSq = eatDist * eatDist;
    const magnetDist = isMagnetActive ? (pRadius + 14.0) : (pRadius + 3.8);
    const magnetDistSq = magnetDist * magnetDist;

    // 1. PLAYER EATING FOOD & MAGNETISM
    if (!gameState.isGameOver && foodGroup) {
        const foods = foodGroup.children;
        const fCount = foods.length;

        for (let i = 0; i < fCount; i++) {
            const food = foods[i];
            const dx = px - food.position.x;
            const dz = pz - food.position.z;

            // Fast AABB reject before doing square calculations
            if (Math.abs(dx) > 16 || Math.abs(dz) > 16) continue;

            const distSq = dx * dx + dz * dz;

            if (distSq < eatDistSq) {
                // Food eaten!
                const fType = food.userData.type || 'normal';
                const fVal = food.userData.value || 2;

                // Handle Food Combo
                const nowMs = performance.now();
                if (nowMs - gameState.lastEatTime < 1200) {
                    gameState.comboCount++;
                    if (gameState.comboCount >= 3) {
                        showComboPopup(gameState.comboCount);
                        gameState.score += gameState.comboCount; // Bonus points!
                    }
                } else {
                    gameState.comboCount = 1;
                }
                gameState.lastEatTime = nowMs;

                // Respawn food at new location
                const newPos = getRandomPosition(MAP_SIZE - 20);
                food.position.set(newPos.x, food.userData.initialY || 0.42, newPos.z);
                food.updateMatrix();

                gameState.score += fVal;

                if (fType === 'mega') {
                    playSound('eatBot');
                    showGameAlert("+8 MEGA GOLD! ⭐", "#ffd700");
                } else if (fType === 'speed') {
                    playSound('boost');
                    showGameAlert("⚡ 2X TEZLIK!", "#00e5ff");
                    gameState.speedMultiplier = 2.4;
                    setTimeout(() => { if (gameState.activeBuff !== 'boost') gameState.speedMultiplier = 1.0; }, 4000);
                } else {
                    playSound('eatFood');
                }

                // Juicy bounce squish pop effect!
                const newScale = getScaleForScore(gameState.score);
                playerMesh.scale.set(newScale * 1.15, newScale * 0.85, newScale * 1.15);
                playerMesh.position.y = newScale / 2;
            } else if (distSq < magnetDistSq) {
                // Food pulled into player!
                const pullStrength = isMagnetActive ? 0.65 : 0.35;
                food.position.x += dx * pullStrength;
                food.position.z += dz * pullStrength;
                food.updateMatrix();
            }
        }
    }

    // 2. PLAYER COLLECTING 3D MYSTERY CRATES
    if (!gameState.isGameOver && cratesGroup) {
        const crates = cratesGroup.children;
        for (let i = 0; i < crates.length; i++) {
            const crate = crates[i];
            const dx = px - crate.position.x;
            const dz = pz - crate.position.z;
            if (dx * dx + dz * dz < (pRadius + 1.2) * (pRadius + 1.2)) {
                // Collect crate!
                const buffs = ['magnet', 'shield', 'boost'];
                const chosen = buffs[Math.floor(Math.random() * buffs.length)];
                triggerPowerup(chosen);
                gameState.score += 20;

                // Respawn crate elsewhere
                const newPos = getRandomPosition(MAP_SIZE - 30);
                crate.position.set(newPos.x, 0.8, newPos.z);
            }
        }
    }

    // 3. PLAYER VS BOTS INTERACTION
    const isPlayerShielded = (gameState.activeBuff === 'shield');

    for (let i = 0; i < botsList.length; i++) {
        const bot = botsList[i];
        const bScale = getScaleForScore(bot.score);
        const bRadius = bScale * 0.55;
        const bx = bot.mesh.position.x;
        const bz = bot.mesh.position.z;

        if (!gameState.isGameOver) {
            const dx = px - bx;
            const dz = pz - bz;
            const collDist = pRadius + bRadius - 0.2;

            if (dx * dx + dz * dz < collDist * collDist) {
                if (gameState.score > bot.score * 1.1) {
                    // Player eats smaller bot!
                    gameState.score += Math.floor(bot.score * 0.45) + 25;
                    playSound('eatBot');
                    showGameAlert(`💥 ${bot.name} YEYILDI! +${Math.floor(bot.score * 0.45) + 25}`, '#00e676');
                    respawnBot(bot);

                    const newScale = getScaleForScore(gameState.score);
                    playerMesh.scale.set(newScale * 1.2, newScale * 0.8, newScale * 1.2);
                } else if (bot.score > gameState.score * 1.1) {
                    if (isPlayerShielded) {
                        // Shield deflects big bot!
                        showGameAlert("🛡️ QALQON SIZNI QUTQARDI!", "#ffd700");
                        bot.mesh.position.x += dx * 3;
                        bot.mesh.position.z += dz * 3;
                    } else {
                        // Big bot eats player -> Game Over
                        triggerGameOver();
                    }
                }
            }
        }

        // Bot eating nearby food (Optimized fast distance check)
        if (foodGroup) {
            const foods = foodGroup.children;
            const fCount = foods.length;
            const bEatSq = (bRadius + 0.8) * (bRadius + 0.8);

            for (let f = 0; f < fCount; f += 2) {
                const food = foods[f];
                const fdx = bx - food.position.x;
                const fdz = bz - food.position.z;
                if (Math.abs(fdx) > 6 || Math.abs(fdz) > 6) continue;

                if (fdx * fdx + fdz * fdz < bEatSq) {
                    const newPos = getRandomPosition(MAP_SIZE - 20);
                    food.position.set(newPos.x, food.userData.initialY || 0.42, newPos.z);
                    food.updateMatrix();
                    bot.score += 2;
                    updateCubeScale(bot.mesh, bot.score);
                }
            }
        }
    }

    // 4. BOT-VS-BOT EATING
    for (let i = 0; i < botsList.length; i++) {
        const botA = botsList[i];
        const radA = getScaleForScore(botA.score) * 0.55;

        for (let j = i + 1; j < botsList.length; j++) {
            const botB = botsList[j];
            const dx = botA.mesh.position.x - botB.mesh.position.x;
            const dz = botA.mesh.position.z - botB.mesh.position.z;

            // Fast AABB reject
            if (Math.abs(dx) > 15 || Math.abs(dz) > 15) continue;

            const radB = getScaleForScore(botB.score) * 0.55;
            const collDist = radA + radB - 0.2;

            if (dx * dx + dz * dz < collDist * collDist) {
                if (botA.score > botB.score * 1.12) {
                    botA.score += Math.floor(botB.score * 0.4) + 15;
                    updateCubeScale(botA.mesh, botA.score);
                    respawnBot(botB);
                } else if (botB.score > botA.score * 1.12) {
                    botB.score += Math.floor(botA.score * 0.4) + 15;
                    updateCubeScale(botB.mesh, botB.score);
                    respawnBot(botA);
                }
            }
        }
    }
}

function respawnBot(bot) {
    const pos = getRandomPosition(MAP_SIZE - 40);
    bot.mesh.position.set(pos.x, 0.5, pos.z);
    bot.score = 0; // 100% Fair respawn at score 0
    updateCubeScale(bot.mesh, 0);
}

// --- SMOOTH CAMERA TRACKING ---
function updateCamera() {
    if (!playerMesh) return;
    const playerScale = getScaleForScore(gameState.score);
    
    const camY = 14 + playerScale * 2.5;
    const camZ = 18 + playerScale * 3.0;

    _camTargetPos.set(
        playerMesh.position.x,
        playerMesh.position.y + camY,
        playerMesh.position.z + camZ
    );

    camera.position.lerp(_camTargetPos, 0.12);
    camera.lookAt(playerMesh.position.x, playerMesh.position.y + 0.5, playerMesh.position.z);
}

// --- UI & LEADERBOARD (THROTTLED TO 5 HZ) ---
let _uiThrottleTimer = 0;

function updateUI() {
    if (elScoreCount) elScoreCount.textContent = formatScore(gameState.score);
    if (elWinsCount) elWinsCount.textContent = gameState.wins;

    _uiThrottleTimer++;
    if (_uiThrottleTimer % 12 !== 0) return;

    const allPlayers = [
        { name: gameState.name, score: gameState.score, isPlayer: true },
        ...botsList.map(b => ({ name: b.name, score: b.score, isPlayer: false }))
    ];

    allPlayers.sort((a, b) => b.score - a.score);
    gameState.rank = allPlayers.findIndex(p => p.isPlayer) + 1;

    if (elLeaderboardPanel) {
        const top5 = allPlayers.slice(0, 5);
        elLeaderboardPanel.innerHTML = top5.map((entry, idx) => `
            <div class="leaderboard-row ${entry.isPlayer ? 'active-player' : ''}">
                <span class="rank-num">${idx + 1}.</span> 
                <span class="rank-name">${entry.name}</span>
            </div>
        `).join('');
    }
}

function triggerGameOver() {
    gameState.isGameOver = true;
    playSound('gameover');

    if (elFinalScore) elFinalScore.textContent = formatScore(gameState.score);
    if (elFinalRank) elFinalRank.textContent = `#${gameState.rank}`;
    if (elGameOverModal) elGameOverModal.classList.remove('hidden');
}

function resetGame() {
    gameState.score = 0;
    gameState.isGameOver = false;
    gameState.activeBuff = null;
    if (playerShieldMesh) playerShieldMesh.visible = false;
    if (elActiveBuff) elActiveBuff.style.display = 'none';

    playerMesh.position.set(0, 0.5, 0);
    updateCubeScale(playerMesh, 0);

    botsList.forEach(bot => {
        const pos = getRandomPosition(MAP_SIZE - 40);
        bot.mesh.position.set(pos.x, 0.5, pos.z);
        bot.score = 0;
        updateCubeScale(bot.mesh, 0);
    });

    if (elGameOverModal) elGameOverModal.classList.add('hidden');
}

// --- MODALS & SKINS CONTROLLER ---
function setupModals() {
    const btnSkins = document.getElementById('btn-skins');
    if (btnSkins && elSkinsModal) {
        btnSkins.addEventListener('click', () => { elSkinsModal.classList.remove('hidden'); });
    }

    document.querySelectorAll('.skin-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.skin-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const skinType = item.getAttribute('data-skin');
            applySkin(skinType);
        });
    });

    const btnEquip = document.getElementById('btn-equip-skin');
    if (btnEquip && elSkinsModal) {
        btnEquip.addEventListener('click', () => { elSkinsModal.classList.add('hidden'); });
    }

    const btnWheel = document.getElementById('btn-wheel');
    if (btnWheel && elWheelModal) {
        btnWheel.addEventListener('click', () => { elWheelModal.classList.remove('hidden'); });
    }

    let isSpinning = false;
    const btnSpin = document.getElementById('btn-spin-wheel');
    if (btnSpin) {
        btnSpin.addEventListener('click', () => {
            if (isSpinning) return;
            isSpinning = true;
            playSound('spin');

            const spinner = document.getElementById('wheel-spinner');
            const randomRot = 1440 + Math.floor(Math.random() * 360);
            if (spinner) spinner.style.transform = `rotate(${randomRot}deg)`;

            setTimeout(() => {
                isSpinning = false;
                gameState.score += 250;
                playSound('eatBot');
                alert('🎉 Tabriklaymiz! Siz +250 Ball yutib oldingiz!');
                if (elWheelModal) elWheelModal.classList.add('hidden');
                if (spinner) spinner.style.transform = 'rotate(0deg)';
            }, 4200);
        });
    }

    const btnGift = document.getElementById('btn-gift');
    if (btnGift && elGiftModal) {
        btnGift.addEventListener('click', () => { elGiftModal.classList.remove('hidden'); });
    }

    const btnClaimGift = document.getElementById('btn-claim-gift');
    if (btnClaimGift && elGiftModal) {
        btnClaimGift.addEventListener('click', () => {
            gameState.score += 250;
            playSound('eatBot');
            elGiftModal.classList.add('hidden');
        });
    }

    const btnExit = document.getElementById('btn-exit');
    if (btnExit) {
        btnExit.addEventListener('click', () => {
            if (confirm('O\'yindan chiqishni xohlaysizmi?')) {
                resetGame();
            }
        });
    }

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-backdrop').classList.add('hidden');
        });
    });

    const btnRespawn = document.getElementById('btn-respawn');
    if (btnRespawn) btnRespawn.addEventListener('click', resetGame);
}

function applySkin(skinType) {
    gameState.skin = skinType;
    let colorHex = '#1e88e5';

    if (skinType === 'yellow-cool') colorHex = '#ffee58';
    if (skinType === 'red-angry') colorHex = '#ef5350';
    if (skinType === 'ninja') colorHex = '#37474F';
    if (skinType === 'robot') colorHex = '#26c6da';
    if (skinType === 'gold') colorHex = '#ffb300';

    const faceTex = createFaceTexture(skinType, colorHex);
    const sideMat = new THREE.MeshLambertMaterial({ color: colorHex });
    const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });

    playerMesh.material = [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat];
}
