import './style.css'
import { Player } from './Player'

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

console.log('Player 1:', player1)
console.log('Player 2:', player2)

// --- Input Handling ---
const pressedKeys = new Set<string>();

// Combined keydown listener
document.addEventListener('keydown', (event) => {
    pressedKeys.add(event.key);

    // Handle jumps on key press
    if (event.key === 'w') {
        player1.jump();
    }
    if (event.key === 'ArrowUp') {
        player2.jump();
    }

    // Handle kick input
    if (event.key === 's') {
        player1.startKick();
    }
    if (event.key === 'ArrowDown') {
        player2.startKick();
    }

    // TODO: Handle other inputs like pause, debug toggle?
});

document.addEventListener('keyup', (event) => {
    pressedKeys.delete(event.key);
});

function handleInput() {
    // Player 1 Controls (WASD)
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

    // Player 2 Controls (Arrow Keys)
     // Check if 'ArrowLeft' is pressed but not 'ArrowRight'
    if (pressedKeys.has('ArrowLeft') && !pressedKeys.has('ArrowRight')) {
        player2.vx = -player2.playerSpeed;
        player2.facingDirection = -1;
    // Check if 'ArrowRight' is pressed but not 'ArrowLeft'
    } else if (pressedKeys.has('ArrowRight') && !pressedKeys.has('ArrowLeft')) {
        player2.vx = player2.playerSpeed;
        player2.facingDirection = 1;
     // If both or neither are pressed, stop horizontal movement
    } else {
        player2.vx = 0;
    }
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

    // --- Update game state --- 
    player1.update(dt, GROUND_Y, SCREEN_WIDTH);
    player2.update(dt, GROUND_Y, SCREEN_WIDTH);
    // ball.update(dt);
    // handleCollisions();
    // checkGoal();
    // updatePowerups();

    // --- Handle Collisions ---
    handlePlayerCollisions(player1, player2);

    // --- Draw everything --- 
    // drawBackground(ctx)
    // drawField(ctx)
    player1.draw(ctx!)
    player2.draw(ctx!)
    // ball.draw(ctx)
    // drawPowerups(ctx)
    // drawScoreboard(ctx)

    // Request next frame
    requestAnimationFrame(gameLoop)
}

// Start the game loop
requestAnimationFrame(gameLoop)
