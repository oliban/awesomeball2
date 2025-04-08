import './style.css'
import { Player, setPlayerSoundFunction } from './Player'
import { Ball } from './Ball'

// --- Constants (Based on reference/awesome-ball/main.py) ---
const SCREEN_WIDTH = 800
const SCREEN_HEIGHT = 600
const GROUND_Y = SCREEN_HEIGHT - 50
const GRAVITY = 0.5 * 60 * 60 // Adjusted for dt in seconds (pixels/sec^2) -> ~1800
const BASE_PLAYER_SPEED = 4 * 60 // Adjusted for dt in seconds (pixels/sec) -> 240
const BASE_JUMP_POWER = -11 * 60 // Adjusted for dt in seconds (pixels/sec) -> -660

// Team Colors (Examples)
const P1_COLOR_MAIN = '#DCDCDC' // Light grey
const P1_COLOR_ACCENT = '#1E1E1E' // Dark grey
const P2_COLOR_MAIN = '#009246' // Italy Green
const P2_COLOR_ACCENT = '#CE2B37' // Italy Red
const SKY_BLUE = '#87CEEB'
const GRASS_GREEN = '#228B22'

// Ball specific constants
const BALL_RADIUS = 15;
const BALL_FRICTION = 0.99; // Air friction
const BALL_GROUND_FRICTION = 0.95; // Ground friction
// const BALL_BOUNCE = 0.7; // OLD Bounce coefficient (0-1)
const BALL_BOUNCE = 0.93; // NEW Even Bouncier!

// Kick specific constants
const KICK_FOOT_RADIUS = 5;       // Size of the 'foot' hitbox for kicking
const KICK_FORWARD_BUFFER = 45;   // NEW Drastically increased extra reach
const KICK_FORCE_HORIZONTAL = 600; // Adjust strength as needed
const KICK_FORCE_VERTICAL = -450;  // Adjust vertical lift as needed
const KICK_MOMENTUM_TRANSFER = 0.3; // Factor of ball's velocity added to kick

// Goal Constants (RE-ADDED)
const POST_THICKNESS = 8;      // Thickness of the crossbar & back pole
const GOAL_HEIGHT = 150;     // Height of the net area below crossbar / height of back pole
const GOAL_WIDTH = 50;       // Width of the goal opening (halved)
const GOAL_Y_POS = GROUND_Y - GOAL_HEIGHT; // Y position of the top of the net/bottom of crossbar
const LEFT_GOAL_X = 0;       // Left edge of the left goal structure
const RIGHT_GOAL_X = SCREEN_WIDTH - GOAL_WIDTH; // Left edge of the right goal structure
const POST_BOUNCE = 0.8;     // NEW - Bouncier!

// --- Score Keeping (RE-ADDED) ---
let player1Score = 0;
let player2Score = 0;

// --- Sound Effects --- (Using Web Audio API)
const audioContext = new AudioContext();
const soundBuffers = new Map<string, AudioBuffer>(); // To store loaded sounds

// Master volume control (0-1 range)
let masterVolume = 0.7;
// Create a master gain node for volume control
const masterGainNode = audioContext.createGain();
masterGainNode.gain.value = masterVolume;
masterGainNode.connect(audioContext.destination);

// Background music
let bgMusic: AudioBufferSourceNode | null = null;
let bgMusicBuffer: AudioBuffer | null = null;
let bgMusicGain: GainNode | null = null;
const bgMusicVolume = 0.4; // Default background music volume (lower than sound effects)
let isMusicPlaying = false;

// Audio effect settings
const REVERB_ENABLED = true;
const ECHO_ENABLED = true;
const REVERB_LEVEL = 0.2; // Amount of reverb (0-1)
const ECHO_DELAY = 0.3; // Echo delay in seconds
const ECHO_FEEDBACK = 0.3; // Echo feedback amount (0-1)

// URLs for the sounds - Using actual sound files
const kickSoundUrls = [
    'sounds/kick_ball1.mp3',
    'sounds/kick_ball2.mp3',
    'sounds/kick_ball3.mp3'
];
const hitSoundUrls = [
    'sounds/body_hit1.mp3',
    'sounds/headbutt1.mp3',
    'sounds/player_bump1.mp3'
];
const wallHitSoundUrls = [
    'sounds/wall_hit1.mp3'
];
const ballBounceSoundUrls = [
    'sounds/ball_bounce1.mp3'
];
const crossbarHitSoundUrls = [
    'sounds/crossbar_hit.mp3'
];
const landSoundUrls = [
    'sounds/land1.mp3',
    'sounds/land2.mp3'
];
const jumpSoundUrls = [
    'sounds/jump1.mp3'
];
const player1GoalSoundUrls = [
    'sounds/player1_goal1.mp3',
    'sounds/player1_goal2.mp3',
    'sounds/player1_goal3.mp3'
];
const player2GoalSoundUrls = [
    'sounds/player2_goal1.mp3',
    'sounds/player2_goal2.mp3',
    'sounds/player2_goal3.mp3'
];
const countdownSoundUrls = [
    'sounds/5.mp3',
    'sounds/4.mp3',
    'sounds/3.mp3',
    'sounds/2.mp3',
    'sounds/1.mp3',
    'sounds/0.mp3'
];

// Background music
const backgroundMusicUrls = [
    'sounds/sample.ogg' // Using the sample OGG file we have
];

// Function to load a sound file into an AudioBuffer
async function loadSoundBuffer(url: string): Promise<AudioBuffer | null> {
    console.log(`Requesting buffer for: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log(`Successfully decoded buffer for: ${url}`);
        return audioBuffer;
    } catch (error) {
        console.error(`Error loading or decoding sound ${url}:`, error);
        return null;
    }
}

// Create a reverb effect
async function createReverb(): Promise<ConvolverNode | null> {
    try {
        // Create a convolver node
        const convolver = audioContext.createConvolver();
        
        // Generate an impulse response (simplified version)
        const sampleRate = audioContext.sampleRate;
        const length = sampleRate * 2; // 2 seconds
        const impulseResponse = audioContext.createBuffer(2, length, sampleRate);
        
        // Fill both channels with decreasing random values to simulate a simple reverb
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulseResponse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                // Exponential decay
                const decay = Math.exp(-i / (sampleRate * 0.5));
                channelData[i] = (Math.random() * 2 - 1) * decay;
            }
        }
        
        convolver.buffer = impulseResponse;
        return convolver;
    } catch (error) {
        console.error("Error creating reverb:", error);
        return null;
    }
}

// Create a delay effect (echo)
function createEcho(): DelayNode {
    const delay = audioContext.createDelay();
    delay.delayTime.value = ECHO_DELAY;
    
    // Create a feedback loop
    const feedback = audioContext.createGain();
    feedback.gain.value = ECHO_FEEDBACK;
    
    // Connect delay -> feedback -> delay to create feedback loop
    delay.connect(feedback);
    feedback.connect(delay);
    
    return delay;
}

// Create audio effects chain
let reverbNode: ConvolverNode | null = null;
let echoNode: DelayNode | null = null;

async function setupAudioEffects() {
    try {
        if (REVERB_ENABLED) {
            reverbNode = await createReverb();
            if (reverbNode) {
                const reverbGain = audioContext.createGain();
                reverbGain.gain.value = REVERB_LEVEL;
                reverbNode.connect(reverbGain);
                reverbGain.connect(masterGainNode);
            }
        }
        
        if (ECHO_ENABLED) {
            echoNode = createEcho();
            const echoGain = audioContext.createGain();
            echoGain.gain.value = 0.3; // Echo level
            echoNode.connect(echoGain);
            echoGain.connect(masterGainNode);
        }
    } catch (error) {
        console.error("Error setting up audio effects:", error);
    }
}

// Call setup when AudioContext is ready
setupAudioEffects();

// Function to play a loaded AudioBuffer with effects
function playSoundBuffer(buffer: AudioBuffer, isImportantSound: boolean = false) {
    if (!buffer) return;
    try {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        
        // Create a gain node for this sound
        const gainNode = audioContext.createGain();
        gainNode.gain.value = isImportantSound ? 1.0 : 0.8; // Important sounds play louder
        
        // Connect source to gain node
        source.connect(gainNode);
        
        // Connect to effects if enabled and appropriate for this sound
        if (echoNode && isImportantSound) {
            // Only important sounds get echo effect
            gainNode.connect(echoNode);
        }
        
        if (reverbNode) {
            // All sounds get some reverb
            gainNode.connect(reverbNode);
        }
        
        // Always connect to master output
        gainNode.connect(masterGainNode);
        
        source.start(0); // Play immediately
        console.log("Started playback via Web Audio API");
    } catch (error) {
        console.error("Error playing sound buffer:", error);
    }
}

// Play a random sound from a sound URL array
function playSound(soundUrlArray: string[], isImportantSound: boolean = false) { 
    if (!soundUrlArray || soundUrlArray.length === 0) {
        console.error("Attempted to play sound from an empty URL array.");
        return;
    }
    // Select a random sound URL from the array
    const randomIndex = Math.floor(Math.random() * soundUrlArray.length);
    const urlToPlay = soundUrlArray[randomIndex];
    
    console.log(`Attempting to play sound URL: ${urlToPlay}`); 
    const buffer = soundBuffers.get(urlToPlay); // Get preloaded buffer

    if (buffer) {
        playSoundBuffer(buffer, isImportantSound);
    } else {
        console.warn(`Sound buffer not found or not loaded yet for ${urlToPlay}. Attempting direct load & play.`);
        // Fallback: Try loading and playing on the fly 
        loadSoundBuffer(urlToPlay).then(directBuffer => {
            if(directBuffer) playSoundBuffer(directBuffer, isImportantSound);
        });
    }
}

// Function to start background music
function startBackgroundMusic() {
    // Disabled as per user request
    console.log("Background music disabled by user request");
    return;
}

// Function to stop background music
function stopBackgroundMusic() {
    if (!isMusicPlaying || !bgMusic) return;
    
    try {
        bgMusic.stop();
        isMusicPlaying = false;
        console.log("Background music stopped");
    } catch (error) {
        console.error("Error stopping background music:", error);
    }
}

// Function to set master volume (0-1 range)
function setMasterVolume(volume: number) {
    if (volume < 0) volume = 0;
    if (volume > 1) volume = 1;
    
    masterVolume = volume;
    masterGainNode.gain.value = masterVolume;
    console.log(`Master volume set to ${volume.toFixed(2)}`);
}

// --- Preload all sounds using Web Audio API ---
async function preloadSounds() {
    console.log("Starting Web Audio sound preloading...");
    const allSoundArrays = [
        kickSoundUrls, 
        hitSoundUrls, 
        wallHitSoundUrls, 
        ballBounceSoundUrls, 
        crossbarHitSoundUrls,
        landSoundUrls,
        jumpSoundUrls,
        player1GoalSoundUrls,
        player2GoalSoundUrls,
        countdownSoundUrls
        // Removed background music from preloading
    ];
    
    const allUrls: string[] = [];
    allSoundArrays.forEach(array => allUrls.push(...array));
    
    for (const url of allUrls) {
        const buffer = await loadSoundBuffer(url);
        if (buffer) {
            soundBuffers.set(url, buffer); // Store the loaded buffer
        }
    }
    console.log("Web Audio sound preloading finished.");
    
    // Don't start background music
}

// --- Game Setup ---
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')

if (!ctx) {
    throw new Error('Could not get 2D rendering context')
}

// Create Players
const player1 = new Player(
    SCREEN_WIDTH * 0.25, // Start position P1
    GROUND_Y,
    1, // Facing right
    P1_COLOR_MAIN,
    P1_COLOR_ACCENT,
    '#000000',
    GRAVITY,
    BASE_JUMP_POWER,
    BASE_PLAYER_SPEED
)

const player2 = new Player(
    SCREEN_WIDTH * 0.75, // Start position P2
    GROUND_Y,
    -1, // Facing left
    P2_COLOR_MAIN,
    P2_COLOR_ACCENT,
    '#000000',
    GRAVITY,
    BASE_JUMP_POWER,
    BASE_PLAYER_SPEED
)

// Create Ball
const ball = new Ball(
    SCREEN_WIDTH / 2, // Start in center
    GROUND_Y - 100, // Start above ground
    GRAVITY // Only pass gravity
)

console.log('Player 1:', player1)
console.log('Player 2:', player2)

// Register the sound function with the Player class
setPlayerSoundFunction(playSound);

// --- Start Sound Preloading --- (Call the async function)
preloadSounds();

// --- Sound Test Button Setup (Wait for DOM) ---
window.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired. Setting up sound buttons..."); 
    
    // Create container for sound controls
    const soundControlPanel = document.createElement('div');
    soundControlPanel.style.position = 'absolute';
    soundControlPanel.style.top = '10px';
    soundControlPanel.style.right = '10px';
    soundControlPanel.style.padding = '10px';
    soundControlPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    soundControlPanel.style.borderRadius = '5px';
    soundControlPanel.style.color = 'white';
    soundControlPanel.style.zIndex = '1000';
    document.body.appendChild(soundControlPanel);
    
    // Add volume control
    const volumeControl = document.createElement('div');
    volumeControl.style.marginBottom = '10px';
    
    const volumeLabel = document.createElement('label');
    volumeLabel.textContent = 'Volume: ';
    volumeLabel.style.display = 'block';
    volumeControl.appendChild(volumeLabel);
    
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '1';
    volumeSlider.step = '0.01';
    volumeSlider.value = masterVolume.toString();
    volumeSlider.style.width = '100%';
    volumeControl.appendChild(volumeSlider);
    
    volumeSlider.addEventListener('input', () => {
        setMasterVolume(parseFloat(volumeSlider.value));
    });
    
    soundControlPanel.appendChild(volumeControl);
    
    // Test all different sound categories
    const setupSoundButton = (id: string, soundArray: string[], label: string, isImportant: boolean = false) => {
        const button = document.createElement('button');
        button.id = id;
        button.textContent = label;
        button.style.margin = '5px';
        button.style.padding = '5px';
        button.addEventListener('click', () => {
            console.log(`Playing ${label} sound...`);
            playSound(soundArray, isImportant);
        });
        soundControlPanel.appendChild(button);
    };
    
    // Create buttons for testing different sound categories
    setupSoundButton('kickSoundButton', kickSoundUrls, 'Kick');
    setupSoundButton('hitSoundButton', hitSoundUrls, 'Hit');
    setupSoundButton('bounceSoundButton', ballBounceSoundUrls, 'Bounce');
    setupSoundButton('jumpSoundButton', jumpSoundUrls, 'Jump');
    setupSoundButton('goalP1Button', player1GoalSoundUrls, 'Goal P1', true);
    setupSoundButton('goalP2Button', player2GoalSoundUrls, 'Goal P2', true);
});

const keysPressed: { [key: string]: boolean } = {};

// --- Input Handling ---
const pressedKeys = new Set<string>();

// Combined keydown listener
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase(); // Convert to lowercase
    pressedKeys.add(key); // Add the lowercase key

    // Handle jumps on key press - only call jump if player is on ground or on other player's head
    // Check lowercase 'w'
    if (key === 'w') { 
        if (!player1.isJumping || player1.onOtherPlayerHead) {
            player1.jump();
        }
    }
    // Keep ArrowUp as is
    if (event.key === 'ArrowUp') { 
        if (!player2.isJumping || player2.onOtherPlayerHead) {
            player2.jump();
        }
    }

    // Handle kick input
    // Check lowercase 's'
    if (key === 's') { 
        player1.startKick();
    }
    // Keep ArrowDown as is
    if (event.key === 'ArrowDown') { 
        player2.startKick();
    }

    // TODO: Handle other inputs like pause, debug toggle?
});

document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase(); // Convert to lowercase
    pressedKeys.delete(key); // Delete the lowercase key
});

function handleInput() {
    // Player 1 Controls (WASD) - Check lowercase keys
    // Check if 'a' is pressed but not 'd'
    if (pressedKeys.has('a') && !pressedKeys.has('d')) {
        player1.vx = -player1.playerSpeed;
        player1.facingDirection = -1;
    // Check if 'd' is pressed but not 'a'
    } else if (pressedKeys.has('d') && !pressedKeys.has('a')) {
        player1.vx = player1.playerSpeed;
        player1.facingDirection = 1;
    // If both or neither are pressed, stop horizontal movement
    } else {
        player1.vx = 0;
    }

    // Player 2 Controls (Arrow Keys) - Check lowercase arrow key names
     // Check if 'arrowleft' is pressed but not 'arrowright'
    if (pressedKeys.has('arrowleft') && !pressedKeys.has('arrowright')) {
        player2.vx = -player2.playerSpeed;
        player2.facingDirection = -1;
    // Check if 'arrowright' is pressed but not 'arrowleft'
    } else if (pressedKeys.has('arrowright') && !pressedKeys.has('arrowleft')) {
        player2.vx = player2.playerSpeed;
        player2.facingDirection = 1;
     // If both or neither are pressed, stop horizontal movement
    } else {
        player2.vx = 0;
    }
}

// --- NEW: Draw Goals function ---
function drawGoals(ctx: CanvasRenderingContext2D) {
    const goalColor = '#FFFFFF'; // White goals
    ctx.fillStyle = goalColor;
    ctx.strokeStyle = '#000000'; // Black outline
    ctx.lineWidth = 2;

    // Define goal structure using constants - ONLY CROSSBARS for drawing
    const goalDrawRects = [
        // Left Goal Crossbar
        { x: LEFT_GOAL_X, y: GOAL_Y_POS - POST_THICKNESS, width: GOAL_WIDTH, height: POST_THICKNESS }, 
        // Right Goal Crossbar
        { x: RIGHT_GOAL_X, y: GOAL_Y_POS - POST_THICKNESS, width: GOAL_WIDTH, height: POST_THICKNESS },
    ];

    // Draw only the crossbars (Adjust Y position to sit *above* GOAL_Y_POS)
    for (const rect of goalDrawRects) {
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }

    // Optional: Draw a simple net pattern (behind posts)
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.8)'; // MORE VISIBLE NET
    const netSpacing = 10;
    // const netDepth = 30; // REMOVE UNUSED - How deep the net appears visually

    // Left Goal Net
    const leftNetTop = GOAL_Y_POS; // Net starts below crossbar
    const leftNetBottom = GROUND_Y;
    // const leftNetBackX = LEFT_GOAL_X + netDepth; // REMOVE UNUSED Back of the net
    // Slanted vertical lines?
    // Horizontal lines
    for (let y = leftNetTop; y < leftNetBottom; y += netSpacing) {
        ctx.beginPath();
        ctx.moveTo(LEFT_GOAL_X, y);
        ctx.lineTo(LEFT_GOAL_X + GOAL_WIDTH, y); // Span the goal width
        ctx.stroke();
    }
    // Vertical Lines
    for (let x = LEFT_GOAL_X; x < LEFT_GOAL_X + GOAL_WIDTH; x += netSpacing) {
         ctx.beginPath();
         ctx.moveTo(x, leftNetTop);
         ctx.lineTo(x, leftNetBottom); 
         ctx.stroke();
    }

     // Right Goal Net
    const rightNetTop = GOAL_Y_POS; // Net starts below crossbar
    const rightNetBottom = GROUND_Y;
    // const rightNetBackX = RIGHT_GOAL_X + GOAL_WIDTH - netDepth; // REMOVE UNUSED Back of the net
    // Horizontal lines
    for (let y = rightNetTop; y < rightNetBottom; y += netSpacing) {
        ctx.beginPath();
        ctx.moveTo(RIGHT_GOAL_X, y);
        ctx.lineTo(RIGHT_GOAL_X + GOAL_WIDTH, y); // Span the goal width
        ctx.stroke();
    }
     // Vertical lines
    for (let x = RIGHT_GOAL_X; x < RIGHT_GOAL_X + GOAL_WIDTH; x += netSpacing) {
         ctx.beginPath();
         ctx.moveTo(x, rightNetTop);
         ctx.lineTo(x, rightNetBottom);
         ctx.stroke();
    }

    // Draw the visual Back Poles (AFTER net)
    ctx.fillStyle = goalColor; // Use same color as crossbar
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    const backPoles = [
        // Left Goal Back Pole
        { x: LEFT_GOAL_X, y: GOAL_Y_POS, width: POST_THICKNESS, height: GOAL_HEIGHT },
        // Right Goal Back Pole
        { x: SCREEN_WIDTH - POST_THICKNESS, y: GOAL_Y_POS, width: POST_THICKNESS, height: GOAL_HEIGHT },
    ];
    for (const pole of backPoles) {
        ctx.fillRect(pole.x, pole.y, pole.width, pole.height);
        ctx.strokeRect(pole.x, pole.y, pole.width, pole.height);
    }
}

// --- NEW: Function to draw the scoreboard ---
function drawScoreboard(ctx: CanvasRenderingContext2D, score1: number, score2: number) {
    const scoreText = `${score1} - ${score2}`;
    const fontSize = 32;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Draw outline first
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.strokeText(scoreText, SCREEN_WIDTH / 2, 10);

    // Draw filled text
    ctx.fillStyle = 'white';
    ctx.fillText(scoreText, SCREEN_WIDTH / 2, 10);
}

// --- NEW: Function to reset positions after goal ---
function resetPositions(ball: Ball, p1: Player, p2: Player) {
    // Reset Ball
    ball.x = SCREEN_WIDTH / 2;
    ball.y = GROUND_Y - 100; // Start above ground
    ball.vx = 0;
    ball.vy = 0;

    // Reset Player 1
    p1.x = SCREEN_WIDTH * 0.25;
    p1.y = GROUND_Y;
    p1.vx = 0;
    p1.vy = 0;
    p1.facingDirection = 1;
    p1.isKicking = false;
    p1.isJumping = false;
    p1.isTumbling = false;
    p1.tumbleTimer = 0;
    p1.kickTimer = 0;
    // Reset angles?
    // p1.leftThighAngle = STAND_ANGLE; etc.

    // Reset Player 2
    p2.x = SCREEN_WIDTH * 0.75;
    p2.y = GROUND_Y;
    p2.vx = 0;
    p2.vy = 0;
    p2.facingDirection = -1;
    p2.isKicking = false;
    p2.isJumping = false;
    p2.isTumbling = false;
    p2.tumbleTimer = 0;
    p2.kickTimer = 0;
    // Reset angles?
}

// --- Collision Detection Functions ---
function checkRectCollision(rect1: any, rect2: any): boolean {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

function checkFeetOnHeadCollision(feetPlayer: Player, headPlayer: Player): boolean {
    const head = headPlayer.getHeadCircle();
    const feetX = feetPlayer.x;
    const feetY = feetPlayer.y; // Player y is feet position
    const headTopY = head.y - head.radius;
    // Use head center y for bottom check for stability
    const headCenterY = head.y; 
    const headLeftX = head.x - head.radius; 
    const headRightX = head.x + head.radius;

    return (
        feetX >= headLeftX &&
        feetX <= headRightX &&
        feetY >= headTopY && // Feet are at or below head top
        feetY <= headCenterY && // Feet are not significantly below head center
        feetPlayer.vy >= 0 // Player must be falling or landed
    );
}

function handlePlayerCollisions(p1: Player, p2: Player) {
    const body1 = p1.getBodyRect();
    const body2 = p2.getBodyRect();
    let collidedHorizontally = false; // Flag to prevent head-stand if pushed apart

    // 1. Body-Body Collision (Horizontal Separation)
    if (checkRectCollision(body1, body2)) {
        const dx = (body1.x + body1.width / 2) - (body2.x + body2.width / 2);
        const overlapX = (body1.width / 2 + body2.width / 2) - Math.abs(dx);

        if (overlapX > 0) {
            collidedHorizontally = true; // Set flag
            const moveX = overlapX / 2;
            if (dx > 0) { // p1 is to the right of p2
                p1.x += moveX;
                p2.x -= moveX;
            } else { // p1 is to the left of p2
                p1.x -= moveX;
                p2.x += moveX;
            }
            // Stop movement into each other (simple resolution)
            // Apply a small opposing force (bounce) - optional
            const bounceFactor = 0.1;
            p1.vx = -p1.vx * bounceFactor;
            p2.vx = -p2.vx * bounceFactor;
            // Or just stop:
            // p1.vx = 0;
            // p2.vx = 0;
        }
    }

    // 2. Feet-on-Head Collision (only if not horizontally separated this frame)
    if (!collidedHorizontally) {
         if (checkFeetOnHeadCollision(p1, p2)) {
            const headP2 = p2.getHeadCircle();
            p1.y = headP2.y - headP2.radius; // Place p1 feet on top of p2 head
            p1.vy = 0;
            p1.isJumping = false;
            p1.onOtherPlayerHead = true;
         } else if (checkFeetOnHeadCollision(p2, p1)) { // Use else if to prevent simultaneous head stand?
            const headP1 = p1.getHeadCircle();
            p2.y = headP1.y - headP1.radius; // Place p2 feet on top of p1 head
            p2.vy = 0;
            p2.isJumping = false;
            p2.onOtherPlayerHead = true;
         }
    }

    // 3. Kick Collision (Tackle/Tumble)
    const kickImpactStart = 0.2; // When kick becomes active (fraction of kickDuration)
    const kickImpactEnd = 0.5;   // When kick becomes inactive

    if (p1.isKicking) {
        const progress = p1.kickTimer / p1.kickDuration;
        if (progress >= kickImpactStart && progress <= kickImpactEnd) {
            const p1KickerRect = p1.getBodyRect(); // Use body rect for simple kick collision
            // Maybe refine kicker rect to be just the foot later
            if (checkRectCollision(p1KickerRect, body2)) {
                if (!p2.isTumbling) { // Don't tumble if already tumbling
                     p2.startTumble();
                     // TODO: Apply some knockback velocity to p2?
                     // p2.vy = -200; 
                     // p2.vx = p1.facingDirection * 100;
                }
            }
        }
    }

    if (p2.isKicking) {
        const progress = p2.kickTimer / p2.kickDuration;
        if (progress >= kickImpactStart && progress <= kickImpactEnd) {
            const p2KickerRect = p2.getBodyRect(); // Use body rect for simple kick collision
            if (checkRectCollision(p2KickerRect, body1)) {
                 if (!p1.isTumbling) {
                     p1.startTumble();
                     // TODO: Apply knockback?
                }
            }
        }
    }
}

// --- Handle Ball Collisions ---
function handleBallCollisions(ball: Ball, p1: Player, p2: Player) {
    // Fine-tune impact window and collision radius
    // const KICK_IMPACT_START_PROGRESS = 0.20; // REMOVE UNUSED
    // const KICK_IMPACT_END_PROGRESS = 0.50;   // REMOVE UNUSED
    // const KICK_FORCE_HORIZONTAL = 600;      // Moved up
    // const KICK_FORCE_VERTICAL = -450;       // Moved up

    // --- Player Kick Collision Checks ---
    const players = [p1, p2];
    for (const player of players) {
        if (player.isKicking) {
            const kickPoint = player.getKickImpactPoint(); // Assumes this exists and returns {x, y}
            if (!kickPoint) continue; // Skip if player class doesn't provide point

            const dx = ball.x - kickPoint.x;
            const dy = ball.y - kickPoint.y;
            const distSq = dx*dx + dy*dy;
            
            // Increase collision distance check
            // const collisionDistance = ball.radius + KICK_FOOT_RADIUS; // OLD
            const collisionDistance = ball.radius + KICK_FOOT_RADIUS + KICK_FORWARD_BUFFER; // NEW with buffer
            const collisionDistanceSq = collisionDistance * collisionDistance;

            if (distSq < collisionDistanceSq) {
                console.log("Kick collision!");
                
                // Determine power based on kick timing
                const kickProgress = player.kickTimer / player.kickDuration;
                const impactThreshold = 0.25; // Hit before this = weak, after = strong
                const powerScaleFactor = (kickProgress < impactThreshold) ? 0.3 : 1.0;
                console.log(`Kick Progress: ${kickProgress.toFixed(2)}, Power Scale: ${powerScaleFactor}`);

                // Simplified base kick force (adjust if needed), scaled by timing
                const kickDirX = player.facingDirection; // Direction player is facing
                const baseKickVX = kickDirX * KICK_FORCE_HORIZONTAL * powerScaleFactor;
                const baseKickVY = KICK_FORCE_VERTICAL * powerScaleFactor; // Typically upwards

                // Calculate momentum contribution based on PLAYER'S velocity, scaled down by 60%
                const momentumScaleFactor = 0.4; // Reduce momentum contribution significantly
                const momentumBoostVX = player.vx * momentumScaleFactor; 
                const momentumBoostVY = player.vy * momentumScaleFactor;

                // Combine base kick and momentum boost
                const finalKickVX = baseKickVX + momentumBoostVX;
                const finalKickVY = baseKickVY + momentumBoostVY;

                console.log(` Kick Details: Base=(${baseKickVX.toFixed(0)}, ${baseKickVY.toFixed(0)}), ` +
                            `Momentum=(${momentumBoostVX.toFixed(0)}, ${momentumBoostVY.toFixed(0)}), ` +
                            `Final=(${finalKickVX.toFixed(0)}, ${finalKickVY.toFixed(0)})`);

                // Apply the final combined force
                ball.applyKick(finalKickVX, finalKickVY); // NEW Call with momentum

                // --- Play Kick Sound (Random) ---
                playSound(kickSoundUrls, true);

                // Prevent multiple hits per kick / prioritize kick over body/head
                continue; // Skip body/head checks for this player if kick connected
            }
        }

        // --- Other Ball/Player Collisions (Body/Head) ---
        // If we reached here, no kick collision occurred for this player this frame
        const bodyRect = player.getBodyRect();
        const headCircle = player.getHeadCircle();

        // Check collision with body (Simplified AABB vs Circle for now)
        const closestX = Math.max(bodyRect.x, Math.min(ball.x, bodyRect.x + bodyRect.width));
        const closestY = Math.max(bodyRect.y, Math.min(ball.y, bodyRect.y + bodyRect.height));
        const distXBody = ball.x - closestX;
        const distYBody = ball.y - closestY;
        const distanceSqBody = (distXBody * distXBody) + (distYBody * distYBody);

        if (distanceSqBody < ball.radius * ball.radius) {
             console.log("Body collision");
             // Simple bounce response: push ball away from player center
             const pushX = ball.x - player.x;
             const pushY = ball.y - (player.y - player.legLength * 0.5); // Push from player center-ish Y
             const pushMagnitude = Math.sqrt(pushX * pushX + pushY * pushY);
             const pushForce = 400; // NEW Increased force
             if (pushMagnitude > 0) {
                ball.vx += (pushX / pushMagnitude) * pushForce * 0.2; // Even less horizontal push relatively
                ball.vy += (pushY / pushMagnitude) * pushForce;
             }

             // ADD Positional Correction for Body
             let bodyOverlap = ball.radius - Math.sqrt(distanceSqBody);
             if (bodyOverlap < 0) bodyOverlap = 0;
             const bodyDistance = Math.sqrt(distanceSqBody);
             const bodyPenetrationX = (bodyOverlap * (distXBody / bodyDistance)) || 0;
             const bodyPenetrationY = (bodyOverlap * (distYBody / bodyDistance)) || 0;
             ball.x += bodyPenetrationX + Math.sign(distXBody) * 0.2; // NEW Push out + larger buffer
             ball.y += bodyPenetrationY + Math.sign(distYBody) * 0.2; // NEW Push out + larger buffer

             // --- Play Hit Sound (Random) ---
             playSound(hitSoundUrls, true);
        }

        // Check collision with head (Circle vs Circle)
        const dxHead = ball.x - headCircle.x;
        const dyHead = ball.y - headCircle.y;
        const distSqHead = dxHead*dxHead + dyHead*dyHead;
        const radiiSum = ball.radius + headCircle.radius;

        if (distSqHead < radiiSum * radiiSum) {
            console.log("Head collision");
             // Simple bounce: push ball away from head center
             const pushMagnitude = Math.sqrt(distSqHead);
             const pushForce = 600; // NEW Increased force for headers
             if (pushMagnitude > 0) {
                ball.vx += (dxHead / pushMagnitude) * pushForce;
                ball.vy += (dyHead / pushMagnitude) * pushForce * 1.2; // More vertical push for headers
             }

             // ADD Positional Correction for Head
             let headOverlap = radiiSum - pushMagnitude; // pushMagnitude is distance here
             if (headOverlap < 0) headOverlap = 0;
             const headPenetrationX = (headOverlap * (dxHead / pushMagnitude)) || 0;
             const headPenetrationY = (headOverlap * (dyHead / pushMagnitude)) || 0;
             ball.x += headPenetrationX + Math.sign(dxHead) * 0.2; // NEW Push out + larger buffer
             ball.y += headPenetrationY + Math.sign(dyHead) * 0.2; // NEW Push out + larger buffer

             // --- Play Hit Sound (Random) ---
             playSound(hitSoundUrls, true);
        }
    }

    // --- GOAL CHECK (Before Bounces) ---
    const backPoles = [
        // Left Goal Back Pole (Goal for P2)
        { x: LEFT_GOAL_X, y: GOAL_Y_POS, width: POST_THICKNESS, height: GOAL_HEIGHT },
        // Right Goal Back Pole (Goal for P1)
        { x: SCREEN_WIDTH - POST_THICKNESS, y: GOAL_Y_POS, width: POST_THICKNESS, height: GOAL_HEIGHT },
    ];

    for (const pole of backPoles) {
        // Use Circle-Rect Collision check (adapted from crossbar logic)
        const closestX = Math.max(pole.x, Math.min(ball.x, pole.x + pole.width));
        const closestY = Math.max(pole.y, Math.min(ball.y, pole.y + pole.height));
        const distX = ball.x - closestX;
        const distY = ball.y - closestY;
        const distanceSq = distX*distX + distY*distY;

        if (distanceSq < ball.radius * ball.radius) {
            // GOAL SCORED!
            if (pole.x < SCREEN_WIDTH / 2) { // Left pole hit
                player2Score++;
                console.log(`%cGOAL for Player 2! Score: P1 ${player1Score} - P2 ${player2Score}`, 'color: green; font-weight: bold;');
                playSound(player2GoalSoundUrls, true);
            } else { // Right pole hit
                player1Score++;
                console.log(`%cGOAL for Player 1! Score: P1 ${player1Score} - P2 ${player2Score}`, 'color: blue; font-weight: bold;');
                playSound(player1GoalSoundUrls, true);
            }
            resetPositions(ball, p1, p2); // NEW Call
            return; // Exit collision handling for this frame
        }
    }

    // --- Crossbar Collisions (ONLY CROSSBARS) ---
    const crossbars = [
        // Left Goal Crossbar
        { x: LEFT_GOAL_X, y: GOAL_Y_POS - POST_THICKNESS, width: GOAL_WIDTH, height: POST_THICKNESS },
        // Right Goal Crossbar
        { x: RIGHT_GOAL_X, y: GOAL_Y_POS - POST_THICKNESS, width: GOAL_WIDTH, height: POST_THICKNESS },
    ];

    for (const post of crossbars) { // Renamed loop variable for clarity
        // REMOVED: if (post.height !== POST_THICKNESS) continue;

        // Need to check collision between circle (ball) and rectangle (post)
        // Find the closest point on the rectangle to the ball's center
        const closestX = Math.max(post.x, Math.min(ball.x, post.x + post.width));
        const closestY = Math.max(post.y, Math.min(ball.y, post.y + post.height));

        // Calculate the distance between ball center and closest point
        const distX = ball.x - closestX;
        const distY = ball.y - closestY;
        const distanceSq = distX*distX + distY*distY;

        // Check if the distance is less than the ball's radius squared (collision)
        if (distanceSq < ball.radius * ball.radius) {
             console.log(`Crossbar collision!`); // Keep basic collision log
            const distance = Math.sqrt(distanceSq);
            let overlap = ball.radius - distance;
            if (overlap < 0) overlap = 0; 

            const penetrationX = (overlap * (distX / distance)) || 0;
            const penetrationY = (overlap * (distY / distance)) || 0;

            console.log(` ClosestX: ${closestX.toFixed(1)}, ClosestY: ${closestY.toFixed(1)}, ` +
                        `DistX: ${distX.toFixed(1)}, DistY: ${distY.toFixed(1)}, ` +
                        `Overlap: ${overlap.toFixed(1)}`);

            // Decide response based on penetration vector direction
            if (Math.abs(distX) > Math.abs(distY)) { // Collision is more horizontal 
                 console.log(' Side hit');
                ball.vx = -ball.vx * POST_BOUNCE; 
                ball.vy *= 0.95; 
                ball.x += penetrationX + Math.sign(distX) * 0.1; 
                playSound(crossbarHitSoundUrls, true);
            } else { // Collision is more vertical 
                if (distY < 0) { // Hit TOP of crossbar 
                     console.log(' Top hit');
                    // Position correction first
                    ball.y += penetrationY - 0.1; // Push ball up
                    // Then apply bounce UPWARDS
                    ball.vy = -Math.abs(ball.vy * POST_BOUNCE); // CORRECT - Bounce UP
                    // Add extra upward speed if bounce was weak
                    if (ball.vy > -80) ball.vy -= 80; // Ensure minimum upward speed
                    playSound(crossbarHitSoundUrls, true);
                } else { // Hit BOTTOM of crossbar 
                     console.log(' Bottom hit');
                    // Bounce first
                    ball.vy = -Math.abs(ball.vy * POST_BOUNCE); 
                    // Add extra upward speed if bounce was weak
                    if (ball.vy > -80) ball.vy -= 80; // NEW Additive Minimum
                    // Set position clearly below
                    ball.y = post.y + post.height + ball.radius + 0.5; // Direct Placement with larger buffer
                    // ADD small horizontal nudge away from post center
                    ball.x += Math.sign(ball.x - (post.x + post.width / 2)) * 1.0;
                    playSound(crossbarHitSoundUrls, true);
                }
                ball.vx *= 0.95; 
            }
        }
    }

    // Add ground bounce sound for the ball
    if (ball.y + ball.radius >= GROUND_Y && ball.vy > 200) {
        playSound(ballBounceSoundUrls, true);
    }
    
    // Add wall bounce sound
    if ((ball.x - ball.radius <= 0 || ball.x + ball.radius >= SCREEN_WIDTH) && Math.abs(ball.vx) > 200) {
        playSound(wallHitSoundUrls, true);
    }
}

// Keep the dev server running, but comment out loop start for now
console.log('Game setup complete. Loop not started yet.')

// --- Game Loop --- 
let lastTime = 0; // Declare lastTime outside the loop

function gameLoop(timestamp: number) {
    // Calculate delta time (dt)
    if (!lastTime) {
        lastTime = timestamp; // Initialize on first frame
    }
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000); // Delta time in seconds, capped at 50ms
    lastTime = timestamp;

    // Handle Input FIRST
    handleInput();

    // Clear canvas
    ctx!.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)

    // --- Draw Background & Field ---
    // Sky
    ctx!.fillStyle = SKY_BLUE;
    ctx!.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Grass
    ctx!.fillStyle = GRASS_GREEN;
    ctx!.fillRect(0, GROUND_Y, SCREEN_WIDTH, SCREEN_HEIGHT - GROUND_Y);

    // --- Draw Goals (ADDED CALL) ---
    drawGoals(ctx!); 

    // --- Update game state --- 
    player1.update(dt, GROUND_Y, SCREEN_WIDTH);
    player2.update(dt, GROUND_Y, SCREEN_WIDTH);
    ball.update(dt, GROUND_Y, SCREEN_WIDTH);
    // handleCollisions();
    // checkGoal();
    // updatePowerups();

    // --- Handle Collisions ---
    handlePlayerCollisions(player1, player2);
    handleBallCollisions(ball, player1, player2);
    // TODO: handleBallCollisions(ball, player1, player2);

    // --- Draw everything --- 
    // drawBackground(ctx)
    // drawField(ctx)
    player1.draw(ctx!)
    player2.draw(ctx!)
    ball.draw(ctx!)
    // drawPowerups(ctx)
    // drawScoreboard(ctx)

    // --- Draw Scoreboard (ADDED CALL) ---
    drawScoreboard(ctx!, player1Score, player2Score);

    // Request next frame
    requestAnimationFrame(gameLoop)
}

// Start the game loop
requestAnimationFrame(gameLoop)
