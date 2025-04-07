import './style.css'
import { Player } from './Player'
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
    GRAVITY // Use same gravity
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
    const netDepth = 30; // How deep the net appears visually

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
    const KICK_FORCE_HORIZONTAL = 600;      // Adjust strength as needed
    const KICK_FORCE_VERTICAL = -450;       // Adjust vertical lift as needed
    const KICK_FOOT_RADIUS = 10;           // Reduced test radius (was 20, orig 5)

    const players = [p1, p2];

    for (const player of players) {
        if (player.isKicking) {
            const progress = player.kickTimer / player.kickDuration;
            const isKickingRightLeg = player.facingDirection === 1;
            const footPos = player.getFootPosition(isKickingRightLeg);
            const dx = ball.x - footPos.x;
            const dy = ball.y - footPos.y;
            const distanceSq = dx * dx + dy * dy;
            const collisionDistance = ball.radius + KICK_FOOT_RADIUS;
            const collisionDistanceSq = collisionDistance * collisionDistance;

            // --- DETAILED KICK LOGGING (Log always during kick) ---
            console.log(`Kick Check: Prog=${progress.toFixed(2)}, Foot=(${footPos.x.toFixed(0)}, ${footPos.y.toFixed(0)}), Ball=(${ball.x.toFixed(0)}, ${ball.y.toFixed(0)}), DistSq=${distanceSq.toFixed(0)}, NeededSq=${collisionDistanceSq.toFixed(0)}`);
            // ------------------------------

            if (distanceSq <= collisionDistanceSq) { // Check distance ANY time during kick
                // Collision detected during kick impact!
                console.log("Kick collision! --- FORCE APPLIED ---"); // Make log clearer
                const kickDirX = player.facingDirection;
                ball.applyKick(kickDirX * KICK_FORCE_HORIZONTAL, KICK_FORCE_VERTICAL);

                // Prevent multiple hits per kick (IMPORTANT NOW)
                player.isKicking = false; 
                player.kickTimer = player.kickDuration; // Force kick to end
                // Ideally, add a flag player.hasHitBallThisKick and check it here
            }
        }

        // --- Other Ball/Player Collisions (Body/Head) ---
        // TODO: Implement simple circle-rect or circle-circle collision for body/head
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
            } else { // Right pole hit
                player1Score++;
                console.log(`%cGOAL for Player 1! Score: P1 ${player1Score} - P2 ${player2Score}`, 'color: blue; font-weight: bold;');
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
            } else { // Collision is more vertical 
                if (distY < 0) { // Hit TOP of crossbar 
                     console.log(' Top hit');
                    // Position correction first
                    ball.y += penetrationY - 0.1; // Push ball up
                    // Then apply bounce UPWARDS
                    ball.vy = -Math.abs(ball.vy * POST_BOUNCE); // CORRECT - Bounce UP
                    // Add extra upward speed if bounce was weak
                    if (ball.vy > -80) ball.vy -= 80; // Ensure minimum upward speed
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
                }
                ball.vx *= 0.95; 
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
