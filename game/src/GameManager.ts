import * as C from './Constants';
import { InputHandler } from './InputHandler';
import { Player } from './Player';
import { Ball } from './Ball';
import { UIManager, UIGameState } from './UIManager';
import { PowerupManager } from './PowerupManager';
import { PowerupType } from './Powerup'; // Corrected import for PowerupType
import { ParticleSystem } from './ParticleSystem';
import { Powerup } from './Powerup';
import { audioManager } from './AudioManager';
import { Rocket } from './Rocket';
import { Arrow, ArrowState } from './Arrow';
// import { ArrowState } from './Arrow'; // Commented out - likely removed or unused
import { lerp } from './Utils.ts'; // Correct import path with extension

// Add match point limit to constants if not already there
const MATCH_POINT_LIMIT = 5; // Example limit
const GOAL_RESET_DELAY = 1.5; // Seconds delay after goal

// Define double tap threshold (milliseconds) - maybe move to Constants.ts later
const DOUBLE_TAP_THRESHOLD_MS = 400;

export class GameManager {
    private ctx: CanvasRenderingContext2D;
    private inputHandler: InputHandler;
    private uiManager: UIManager;
    private particleSystem: ParticleSystem;
    private lastTime: number = 0;
    private accumulatedTime: number = 0;
    private timeStep: number = 1 / C.TARGET_FPS; // Time step for fixed update

    private player1: Player;
    private player2: Player;
    private ball: Ball;
    private player1Score: number = 0;
    private player2Score: number = 0;
    private currentState: C.GameState = C.GameState.WELCOME; // Initial state
    private goalMessageTimer: number = 0; // Timer for post-goal delay
    private matchOverTimer: number = 0; // Timer for match over display
    private powerupManager: PowerupManager;
    private activeRockets: Rocket[] = []; // Array to hold active rockets
    private activeArrows: Arrow[] = []; // Array to hold active arrows

    // Goal Power-up State
    private isPlayer1GoalEnlarged: boolean = false; 
    private player1GoalEnlargeTimer: number = 0;
    private isPlayer2GoalEnlarged: boolean = false;
    private player2GoalEnlargeTimer: number = 0;
    // TODO: Add state for Goal Shield later

    // Add state for double-tap detection
    private player1LastKickTime: number = 0;
    private player2LastKickTime: number = 0;
    
    // Helper to spawn a specific powerup type at a location
    // Moved BEFORE constructor to fix runtime error
    private spawnSpecificPowerup(type: PowerupType, x: number, y: number): void {
        const newPowerup = new Powerup(x, y, type);
        // Override physics for instant placement if needed (e.g., set vy = 0)
        // REMOVED: newPowerup.vy = 0;
        // REMOVED: newPowerup.vx = 0;
        // REMOVED: newPowerup.hasParachute = false; // No parachute for debug spawn
        // Let the Powerup constructor handle initial velocity and parachute
        this.powerupManager.addPowerup(newPowerup);
        // console.log(`DEBUG: Spawned ${type} at (${x.toFixed(0)}, ${y.toFixed(0)}) - Should fall now`);
    }

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
        this.inputHandler = new InputHandler();
        this.uiManager = new UIManager(ctx);
        this.powerupManager = new PowerupManager();
        this.particleSystem = new ParticleSystem();

        // Create Players (matching the complex constructor signature found in Player.ts)
        this.player1 = new Player(
            C.SCREEN_WIDTH * 0.25, // x
            C.GROUND_Y,             // y
            1,                      // facing
            '#DCDCDC',              // teamColor
            '#1E1E1E',              // teamAccent
            C.BLACK,                // eyeColor (using constant)
            C.GRAVITY,              // gravity
            C.BASE_JUMP_POWER,      // jumpPower
            C.BASE_PLAYER_SPEED     // playerSpeed
        );

        this.player2 = new Player(
            C.SCREEN_WIDTH * 0.75, // x
            C.GROUND_Y,             // y
            -1,                     // facing
            '#009246',              // teamColor (Italy Green)
            '#CE2B37',              // teamAccent (Italy Red)
            C.BLACK,                // eyeColor
            C.GRAVITY,              // gravity
            C.BASE_JUMP_POWER,      // jumpPower
            C.BASE_PLAYER_SPEED     // playerSpeed
        );

        // Create Ball
        this.ball = new Ball(
            C.SCREEN_WIDTH / 2,
            C.GROUND_Y - 100
        );

        // DEBUG: Spawn initial Rocket Launcher
        // this.spawnSpecificPowerup(PowerupType.ROCKET_LAUNCHER, C.SCREEN_WIDTH / 2, 50);
    }

    private resetPositions(): void {
        // Reset Ball
        this.ball.x = C.SCREEN_WIDTH / 2;
        this.ball.y = C.GROUND_Y - 100;
        this.ball.vx = 0;
        this.ball.vy = 0;
        // Ball freeze timer resets automatically via its update method

        // Reset Player 1
        this.player1.x = C.SCREEN_WIDTH * 0.25;
        this.player1.y = C.GROUND_Y;
        this.player1.vx = 0;
        this.player1.vy = 0;
        this.player1.facingDirection = 1;
        this.player1.isKicking = false;
        this.player1.isJumping = false;
        this.player1.isTumbling = false;
        this.player1.isStunned = false; // Reset stun
        this.player1.stunTimer = 0;
        this.player1.isBeingPushedBack = false; // Reset pushback
        this.player1.pushbackTimer = 0;
        this.player1.isItching = false; // Reset itch
        // Reset public powerup/weapon properties
        this.player1.speedMultiplier = 1.0;
        this.player1.jumpMultiplier = 1.0;
        this.player1.sizeMultiplier = 1.0;
        this.player1.hasRocketLauncher = false;
        this.player1.rocketAmmo = 0;
        this.player1.hasBow = false;
        this.player1.arrowAmmo = 0;
        this.player1.isSword = false;
        // NOTE: Internal powerup timers (speedBoostTimer, etc.) are private in Player
        // and cannot be reset directly from here without a public Player.resetState() method.

        // Reset Player 2
        this.player2.x = C.SCREEN_WIDTH * 0.75;
        this.player2.y = C.GROUND_Y;
        this.player2.vx = 0;
        this.player2.vy = 0;
        this.player2.facingDirection = -1;
        this.player2.isKicking = false;
        this.player2.isJumping = false;
        this.player2.isTumbling = false;
        this.player2.isStunned = false; // Reset stun
        this.player2.stunTimer = 0;
        this.player2.isBeingPushedBack = false; // Reset pushback
        this.player2.pushbackTimer = 0;
        this.player2.isItching = false; // Reset itch
        // Reset public powerup/weapon properties
        this.player2.speedMultiplier = 1.0;
        this.player2.jumpMultiplier = 1.0;
        this.player2.sizeMultiplier = 1.0;
        this.player2.hasRocketLauncher = false;
        this.player2.rocketAmmo = 0;
        this.player2.hasBow = false;
        this.player2.arrowAmmo = 0;
        this.player2.isSword = false;
        // NOTE: Internal powerup timers cannot be reset directly from here.

        this.particleSystem.clear(); // Clear particles on reset
    }

    private startNewMatch(): void {
        console.log("Executing startNewMatch..."); // Add log
        this.player1Score = 0;
        this.player2Score = 0;
        this.resetPositions(); // Includes player state reset now
        
        // Clear active game elements
        this.activeRockets = [];
        this.activeArrows = [];
        // Directly reset the private array in PowerupManager (less ideal, but avoids modifying PowerupManager now)
        if (this.powerupManager && Array.isArray(this.powerupManager['activePowerups'])) {
             this.powerupManager['activePowerups'] = []; 
        } else {
            console.warn("Could not clear powerups in PowerupManager");
        }
        
        this.currentState = C.GameState.PLAYING;
        this.particleSystem.clear(); // Also clear particles here
        console.log("startNewMatch finished. State set to PLAYING."); // Add log
    }

    private checkGoal(): void {
        if (this.currentState !== C.GameState.PLAYING) return;

        // --- Calculate Effective Goal Dimensions for Check --- 
        const enlargeFactor = C.POWERUP_GOAL_ENLARGE_FACTOR;

        // Player 1 Goal (Left)
        const p1GoalWidth = this.isPlayer1GoalEnlarged ? C.GOAL_WIDTH * enlargeFactor : C.GOAL_WIDTH;
        const p1GoalHeight = this.isPlayer1GoalEnlarged ? C.GOAL_HEIGHT * enlargeFactor : C.GOAL_HEIGHT;
        const p1GoalX = C.LEFT_GOAL_X; // X position doesn't change
        const p1GoalY = C.GROUND_Y - p1GoalHeight; // Y position adjusts based on height
        const p1GoalLine = p1GoalX; // The line the ball must cross

        // Player 2 Goal (Right)
        const p2GoalWidth = this.isPlayer2GoalEnlarged ? C.GOAL_WIDTH * enlargeFactor : C.GOAL_WIDTH;
        const p2GoalHeight = this.isPlayer2GoalEnlarged ? C.GOAL_HEIGHT * enlargeFactor : C.GOAL_HEIGHT;
        const p2GoalX = C.RIGHT_GOAL_X - (p2GoalWidth - C.GOAL_WIDTH); // X pos adjusts based on width change
        const p2GoalY = C.GROUND_Y - p2GoalHeight; // Y position adjusts based on height
        const p2GoalLine = p2GoalX + p2GoalWidth; // The line the ball must cross
        // ----------------------------------------------------

        // Check if ball is vertically within either potential goal height
        const ballInP1GoalHeight = this.ball.y > p1GoalY && this.ball.y < C.GROUND_Y;
        const ballInP2GoalHeight = this.ball.y > p2GoalY && this.ball.y < C.GROUND_Y;

        let goalScored = false;
        let scorer: number | null = null;

        // Goal for Player 2 (Ball crossed left goal line AND within P1 goal height)
        if (ballInP1GoalHeight && this.ball.x - this.ball.radius < p1GoalLine) {
            console.log("GOAL P2! (Goal Size Adjusted)");
            this.player2Score++;
            goalScored = true;
            scorer = 2;
        } 
        // Goal for Player 1 (Ball crossed right goal line AND within P2 goal height)
        else if (ballInP2GoalHeight && this.ball.x + this.ball.radius > p2GoalLine) {
            console.log("GOAL P1! (Goal Size Adjusted)");
            this.player1Score++;
            goalScored = true;
            scorer = 1;
        }
        
        if (goalScored) {
            // ... (rest of goal scoring logic remains the same) ...
             // Play standard goal sound first (optional, could be removed if score announcement is enough)
             if (scorer === 1) {
                audioManager.playSound('PLAYER1_GOAL_1');
            } else if (scorer === 2) {
                audioManager.playSound('PLAYER2_GOAL_1');
            }

            this.particleSystem.emit('goal', this.ball.x, this.ball.y, 50); // Emit goal particles
            
            // Check for Match Over
            if (this.player1Score >= MATCH_POINT_LIMIT || this.player2Score >= MATCH_POINT_LIMIT) {
                this.currentState = C.GameState.MATCH_OVER;
                this.matchOverTimer = 3.0; // Display match over message for 3 seconds
                // Play winner announcement sound
                 if (this.player1Score >= MATCH_POINT_LIMIT) {
                    audioManager.playSound('NILS_WINS');
                } else {
                    audioManager.playSound('HARRY_WINS');
                }
            } else {
                // If not match over, set state to goal scored and announce score
                this.currentState = C.GameState.GOAL_SCORED;
                this.goalMessageTimer = GOAL_RESET_DELAY; // Start delay timer

                // Announce the score after a slight delay
                this.announceScore(); 
            }
        }
    }

    private handleCollisions(): void {
        if (this.currentState !== C.GameState.PLAYING) return;

        const players = [this.player1, this.player2];
        let kickAppliedThisFrame = false; 

        // TEMPORARY WORKAROUND: Add a fallback implementation for getKickImpactPoint
        const getKickImpactPointFallback = (player: Player) => {
            // Check if native method exists first
            if (typeof (player as any).getKickImpactPoint === 'function') {
                return (player as any).getKickImpactPoint();
            }
            
            // Fallback implementation - simplified but functional
            if (!player.isKicking) return null;
            
            const legLength = (player as any).legLength || 30; // Default if not available
            const kickDistance = legLength * 0.8;
            const kickOffsetY = player.y - legLength * 0.5; // Halfway up the leg
            
            return {
                x: player.x + (player.facingDirection * kickDistance),
                y: kickOffsetY
            };
        };

        // Check Player-Powerup Collisions FIRST (before other collisions?)
        for (const player of players) {
            const collectedPowerupType = this.powerupManager.checkCollisions(player);
            if (collectedPowerupType) {
                this.applyPowerup(player, collectedPowerupType);
            }
        }

        // --- Player-Player Collision ---
        const p1Body = this.player1.getBodyRect();
        const p2Body = this.player2.getBodyRect();

        if (this.checkRectCollision(p1Body, p2Body)) {
            const dx = (p1Body.x + p1Body.width / 2) - (p2Body.x + p2Body.width / 2);
            const overlapX = (p1Body.width / 2 + p2Body.width / 2) - Math.abs(dx);

            if (overlapX > 0) {
                const moveX = overlapX / 2;
                const pushDirection = Math.sign(dx) || 1; // Ensure non-zero direction

                // Apply positional correction
                this.player1.x += moveX * pushDirection;
                this.player2.x -= moveX * pushDirection;

                // Apply velocity bounce/transfer (Simple bounce for now)
                const bounceFactor = 0.3; // How much velocity is reversed
                const p1vx = this.player1.vx;
                const p2vx = this.player2.vx;
                this.player1.vx = -p1vx * bounceFactor + p2vx * bounceFactor * 0.5;
                this.player2.vx = -p2vx * bounceFactor + p1vx * bounceFactor * 0.5;

                // Optional: Trigger tumble if collision is significant
                // Tumbling removed - only happens on rocket explosion now

                console.log("Player-Player Body Collision");
                audioManager.playSound('PLAYER_BUMP_1'); // Play player bump sound
            }
            // TODO: Add vertical separation/bounce if needed?
        }

        // --- Check Feet-on-Head ---
        // Check if P1 feet are on P2 head
        if (this.checkFeetOnHeadCollision(this.player1, this.player2)) {
             const headP2 = this.player2.getHeadCircle();
             this.player1.y = headP2.y - headP2.radius; // Place p1 feet on top of p2 head
             this.player1.vy = 0; // Stop vertical velocity
             this.player1.isJumping = false;
             this.player1.onOtherPlayerHead = true;
        } else {
            this.player1.onOtherPlayerHead = false; // Reset if not on head
        }
        // Check if P2 feet are on P1 head
        if (this.checkFeetOnHeadCollision(this.player2, this.player1)) {
             const headP1 = this.player1.getHeadCircle();
             this.player2.y = headP1.y - headP1.radius; // Place p2 feet on top of p1 head
             this.player2.vy = 0;
             this.player2.isJumping = false;
             this.player2.onOtherPlayerHead = true;
        } else {
             this.player2.onOtherPlayerHead = false; // Reset if not on head
        }

        // --- Player-Ball Collisions ---
        for (const player of players) {
            // --- Add Prototype Check --- 
            // --- END DEBUG --- 

            // Check for bicycle kick collision first
            if (player.isBicycleKicking && !kickAppliedThisFrame) {
                // Use the dedicated bicycle kick impact point method
                const kickPoint = player.getBicycleKickImpactPoint();
                if (kickPoint) {
                    const dx = this.ball.x - kickPoint.x;
                    const dy = this.ball.y - kickPoint.y;
                    const distSq = dx * dx + dy * dy;
                    const kickRadius = this.ball.radius + 60; // Increased radius further for bicycle kicks (was 40)
                    const kickRadiusSq = kickRadius * kickRadius;

                    console.log(`[Bicycle Kick] Check: dist=${Math.sqrt(distSq).toFixed(1)}, radius=${Math.sqrt(kickRadiusSq).toFixed(1)}`);

                    // Check if the kick point is close enough to the ball
                    if (distSq < kickRadiusSq) {
                        console.log(`BICYCLE KICK CONNECT! Player: ${player === this.player1 ? 1:2}, KickPoint: (${kickPoint.x.toFixed(1)}, ${kickPoint.y.toFixed(1)}), Ball: (${this.ball.x.toFixed(1)}, ${this.ball.y.toFixed(1)})`);
                        audioManager.playSound('KICK_1'); // Play kick sound on connect

                        // --- Bicycle Kick Force (Direction-Based) --- 
                        console.log("Applying Bicycle Kick force (Direction-Based)!");
                        const bicycleKickPowerMultiplier = 2.5; // Keep power level consistent
                        // Define a base magnitude (can be tuned)
                        const baseMagnitude = C.BASE_KICK_FORCE_X * bicycleKickPowerMultiplier * 1.5; // Example magnitude derived from X force

                        // Calculate player's approximate rotation center (world coordinates)
                        const rotationCenterYOffset = -(player.legLength + player.torsoLength / 2);
                        const absRotationCenterX = player.x;
                        const absRotationCenterY = player.y + rotationCenterYOffset;

                        // Calculate direction vector from center to kick point
                        let dirX = kickPoint.x - absRotationCenterX;
                        let dirY = kickPoint.y - absRotationCenterY;
                        const distFromCenter = Math.sqrt(dirX * dirX + dirY * dirY);

                        // Normalize the direction vector
                        if (distFromCenter > 0) {
                            dirX /= distFromCenter;
                            dirY /= distFromCenter;
                        } else {
                            // If kickPoint is exactly at center, use player facing direction as fallback
                            dirX = player.facingDirection;
                            dirY = -0.5; // Default slight upward angle
                        }

                        // Calculate final velocity based on direction and magnitude
                        // Removed randomness for now, as direction should be more precise
                        const finalKickVx = dirX * baseMagnitude;
                        const finalKickVy = dirY * baseMagnitude;

                        // Apply the final force
                        this.ball.applyKick(finalKickVx, finalKickVy);
                        
                        // --- Emit Particles ---
                        this.particleSystem.emit('kick', kickPoint.x, kickPoint.y, 15, { 
                            kickDirection: player.facingDirection, 
                            isBicycle: true
                        });

                        kickAppliedThisFrame = true; 
                        continue; // Skip other ball collisions for this player
                    }
                }
            }

            // Check regular kick collision
            if (player.isKicking && !kickAppliedThisFrame) {
                // Use the Player class's own method now
                const kickPoint = player.getKickImpactPoint(); 
                if (kickPoint) {
                    const dx = this.ball.x - kickPoint.x;
                    const dy = this.ball.y - kickPoint.y;
                    const distSq = dx * dx + dy * dy;
                    const kickRadius = this.ball.radius + 30; // Increased kick collision radius further
                    const kickRadiusSq = kickRadius * kickRadius;

                    // Check if the kick point is close enough to the ball
                    if (distSq < kickRadiusSq) {
                        console.log(`Kick Connect! Player: ${player === this.player1 ? 1:2}, KickPoint: (${kickPoint.x.toFixed(1)}, ${kickPoint.y.toFixed(1)}), Ball: (${this.ball.x.toFixed(1)}, ${this.ball.y.toFixed(1)}), DistSq: ${distSq.toFixed(1)}, RadiusSq: ${kickRadiusSq.toFixed(1)}`);
                        audioManager.playSound('KICK_1'); // Play kick sound on connect

                        // --- Calculate Kick Force --- 
                        let kickVx = 0;
                        let kickVy = 0;

                        if (player.isBicycleKicking) {
                            // --- Bicycle Kick Force --- 
                            console.log("Applying Bicycle Kick force!");
                            const bicycleKickPowerMultiplier = 2.0; // Make it stronger
                            const bicycleKickUpwardFactor = 1.5; // More upward force
                            
                            kickVx = player.facingDirection * C.BASE_KICK_FORCE_X * bicycleKickPowerMultiplier * 0.7; // Slightly less horizontal than vertical
                            kickVy = C.BASE_KICK_FORCE_Y * bicycleKickPowerMultiplier * bicycleKickUpwardFactor; // Strongly upward (more negative)
                            
                            // Maybe add a small amount of player's CURRENT vy? 
                            // kickVy += player.vy * 0.2; 
                            
                        } else {
                            // --- Standard Kick Force (Existing Logic) --- 
                            const momentumScaleFactor = 0.4; // Percentage of player velocity to add
                            const momentumBoostVX = player.vx * momentumScaleFactor; 
                            const momentumBoostVY = player.vy * momentumScaleFactor;

                            // Base Kick Force (Horizontal)
                            const baseKickVx = player.facingDirection * C.BASE_KICK_FORCE_X * 1.5; 
                            
                            // Adjust Base Vertical Kick Force based on Ball Height 
                            let adjustedBaseKickVy = C.BASE_KICK_FORCE_Y * 1.5; // Default upward force (negative value)
                            const volleyThreshold = C.GROUND_Y - this.ball.radius * 2; // Ball center needs to be above this
                        
                            if (this.ball.y < volleyThreshold) {
                                // It's a volley! Reduce upward force significantly.
                                const volleyLiftFactor = 0.2; // Only 20% of the original upward force (make it much less negative)
                                adjustedBaseKickVy *= volleyLiftFactor; 
                                console.log(`Volley kick! Ball Y: ${this.ball.y.toFixed(0)}, Threshold: ${volleyThreshold.toFixed(0)}. Reduced base VY to ${adjustedBaseKickVy.toFixed(0)}`);
                            }
                                                
                            // Combine Base (using adjusted vertical) and Momentum
                            kickVx = baseKickVx + momentumBoostVX;
                            kickVy = adjustedBaseKickVy + momentumBoostVY; // Use the adjusted vertical base

                            console.log(`Standard Kick Details: Base=(${baseKickVx.toFixed(0)}, ${adjustedBaseKickVy.toFixed(0)}), Momentum=(${momentumBoostVX.toFixed(0)}, ${momentumBoostVY.toFixed(0)}), Final=(${kickVx.toFixed(0)}, ${kickVy.toFixed(0)})`);
                        }
                        
                        // --- Apply Randomness (Common to both kick types) ---
                        const originalAngle = Math.atan2(kickVy, kickVx);
                        const originalMagnitude = Math.sqrt(kickVx * kickVx + kickVy * kickVy);

                        const maxRandomAngleOffset = Math.PI / 18; // +/- 10 degrees
                        const randomOffset = (Math.random() * 2 - 1) * maxRandomAngleOffset;
                        const finalAngle = originalAngle + randomOffset;

                        const randomizedKickVx = Math.cos(finalAngle) * originalMagnitude;
                        const randomizedKickVy = Math.sin(finalAngle) * originalMagnitude;

                        console.log(`Kick Randomness: OrigAngle=${originalAngle.toFixed(2)}, Offset=${randomOffset.toFixed(2)}, FinalAngle=${finalAngle.toFixed(2)}`);

                        // Apply the final RANDOMIZED force
                        this.ball.applyKick(randomizedKickVx, randomizedKickVy);
                        
                        // --- Emit Particles (Common) ---
                        this.particleSystem.emit('kick', kickPoint.x, kickPoint.y, player.isBicycleKicking ? 15 : 8, { 
                            kickDirection: player.facingDirection, 
                            isBicycle: player.isBicycleKicking // Pass flag to particles
                        });

                        kickAppliedThisFrame = true; 
                        continue; // Skip other ball collisions for this player if kick connects
                    }
                }
            }

            // --- Player-Ball Headbutt Collision ---
            const headCircle = player.getHeadCircle();
            const dxHead = this.ball.x - headCircle.x;
            const dyHead = this.ball.y - headCircle.y;
            const distSqHead = dxHead * dxHead + dyHead * dyHead;
            const headRadius = headCircle.radius + this.ball.radius + 5; // Add some buffer
            const headRadiusSq = headRadius * headRadius;

            if (distSqHead < headRadiusSq && !player.isKicking) { // Ensure not kicking simultaneously
                console.log("Headbutt Connect!");
                // Apply headbutt force (more vertical)
                const headbuttForceX = C.BASE_KICK_FORCE_X * player.facingDirection * 0.6; // Less horizontal force
                const headbuttForceY = C.BASE_KICK_FORCE_Y * 1.5; // More vertical force
                
                // Factor in player velocity slightly
                const momentumBoostVX = player.vx * 0.3;
                const momentumBoostVY = player.vy * 0.3; 

                this.ball.vx = headbuttForceX + momentumBoostVX;
                this.ball.vy = headbuttForceY + momentumBoostVY;
                kickAppliedThisFrame = true; // Prevent other collisions for this frame
                audioManager.playSound('HEADBUTT_1'); // Play headbutt sound
            }

            // --- Player-Ball Body Collision ---
            // Check only if kick/headbutt didn't connect this frame
            if (!kickAppliedThisFrame) {
                const bodyRect = player.getBodyRect(); // Simple rect for body
                // Check collision between ball circle and player body rect
                if (this.checkCircleRectCollision(this.ball, bodyRect)) {
                    // console.log("Player-Ball Body Collision");

                    // Simple positional correction: Push ball out along axis of least penetration
                    const closestX = Math.max(bodyRect.x, Math.min(this.ball.x, bodyRect.x + bodyRect.width));
                    const closestY = Math.max(bodyRect.y, Math.min(this.ball.y, bodyRect.y + bodyRect.height));
                    const distToClosestX = this.ball.x - closestX;
                    const distToClosestY = this.ball.y - closestY;
                    const distToClosestSq = (distToClosestX * distToClosestX) + (distToClosestY * distToClosestY);

                    if (distToClosestSq < this.ball.radius * this.ball.radius) {
                        const dist = Math.sqrt(distToClosestSq);
                        const overlap = this.ball.radius - dist;
                        if (dist > 0) {
                            const pushX = (distToClosestX / dist) * overlap;
                            const pushY = (distToClosestY / dist) * overlap;
                            this.ball.x += pushX;
                            this.ball.y += pushY;
                        }
                        
                        // Apply some bounce based on relative velocity (simplified)
                        const relativeVx = this.ball.vx - player.vx;
                        const relativeVy = this.ball.vy - player.vy;
                        const bounceFactor = 0.5;
                        this.ball.vx = player.vx + -relativeVx * bounceFactor;
                        this.ball.vy = player.vy + -relativeVy * bounceFactor;

                        audioManager.playSound('BODY_HIT_1'); // Play body hit sound
                    }
                }
            }
        }

        const ball = this.ball; // Alias for brevity

        // --- Ball-Wall Collision (Vertical Walls) ---
        if (ball.x - ball.radius < C.GOAL_LINE_X_LEFT || ball.x + ball.radius > C.GOAL_LINE_X_RIGHT) {
            // Allow passing through goal sides, reflect only if above goal height
            if (ball.y < C.GOAL_Y_POS) { 
                ball.vx *= -C.WALL_BOUNCE; // Use new constant
                // Correct position immediately to prevent sticking
                ball.x = (ball.x < C.SCREEN_WIDTH / 2) ? C.GOAL_LINE_X_LEFT + ball.radius : C.GOAL_LINE_X_RIGHT - ball.radius;
                this.particleSystem.emit('dust', ball.x, ball.y, 8); // Increased count
            }
        }

        // --- Ball-Ceiling Collision ---
        if (ball.y - ball.radius < 0) {
            ball.y = ball.radius; // Correct position
            ball.vy *= -C.WALL_BOUNCE; // Use new constant
            this.particleSystem.emit('dust', ball.x, ball.y, 8); // Increased count
        }

        // --- Ball-Ground Collision ---
        if (ball.y + ball.radius > C.GROUND_Y) {
            ball.y = C.GROUND_Y - ball.radius; // Correct position
            ball.vy *= -C.GROUND_BOUNCE; // Use new constant
            // Apply horizontal friction only when on ground
            ball.applyGroundFriction(); 
            // Reduce spin on bounce
            ball.rotationSpeed *= 0.8; 
            // Only emit dust if bounce is significant
            if (Math.abs(ball.vy) > 20) { // Threshold to avoid constant emission
                this.particleSystem.emit('dust', ball.x, ball.y, 12, {color: '#A0522D'}); // Increased count
            }
        }

        // --- Player Kick vs Player Head Collision ---
        for (const kicker of players) {
            const target = (kicker === this.player1) ? this.player2 : this.player1;
            
            if (kicker.isKicking && !target.isTumbling && !target.isBeingPushedBack) { // Check states
                // Use our fallback implementation here too
                const kickPoint = getKickImpactPointFallback(kicker);
                if (kickPoint) {
                    const targetHead = target.getHeadCircle();
                    const dx = kickPoint.x - targetHead.x;
                    const dy = kickPoint.y - targetHead.y;
                    const distSq = dx * dx + dy * dy;
                    const collisionRadius = targetHead.radius + 5; // Buffer
                    const collisionRadiusSq = collisionRadius * collisionRadius;

                    if (distSq < collisionRadiusSq) {
                        console.log(`Player ${kicker === this.player1 ? 1 : 2} kicked Player ${target === this.player1 ? 1 : 2} in the head! Pushback!`);

                        const pushbackForceX = C.KICK_HEAD_PUSHBACK_FORCE_X;
                        const pushbackForceY = C.KICK_HEAD_PUSHBACK_FORCE_Y;
                        target.vx = pushbackForceX * kicker.facingDirection;
                        target.vy = -pushbackForceY;
                        target.isJumping = true;
                        target.onOtherPlayerHead = false;
                        target.onLeftCrossbar = false;
                        target.onRightCrossbar = false;
                        target.isBeingPushedBack = true;
                        target.pushbackTimer = C.PUSHBACK_DURATION;

                        audioManager.playSound('BODY_HIT_1'); 
                        kicker.isKicking = false; 
                    }
                }
            }
        }
        
        // --- Rocket Collisions ---
        for (let i = this.activeRockets.length - 1; i >= 0; i--) {
            const rocket = this.activeRockets[i];
            if (!rocket.isActive) continue; // Skip inactive rockets

            const rocketRect = rocket.getRect();
            let exploded = false;

            // Check Rocket vs Players
            for (const player of players) {
                if (player === rocket.owner) continue; // Don't collide with self

                const playerBodyRect = player.getBodyRect();
                const playerHeadCircle = player.getHeadCircle();

                // Check body collision
                if (this.checkRectCollision(rocketRect, playerBodyRect)) {
                    console.log(`Rocket hit Player ${player === this.player1 ? 1 : 2} body`);
                    exploded = true;
                    break; // Rocket explodes on first player hit
                }
                // Check head collision (circle-rect)
                if (!exploded && this.checkCircleRectCollision(playerHeadCircle, rocketRect)) {
                     console.log(`Rocket hit Player ${player === this.player1 ? 1 : 2} head`);
                    exploded = true;
                    break; // Rocket explodes on first player hit
                }
            }

            // Check Rocket vs Ball (only if not already exploded)
            // Use ball's direct properties for circle-rect check
            const ballCircle = { x: this.ball.x, y: this.ball.y, radius: this.ball.radius };
            if (!exploded && this.checkCircleRectCollision(ballCircle, rocketRect)) {
                console.log("Rocket hit Ball");
                exploded = true;
            }

            // Handle explosion if occurred
            if (exploded) {
                this.createExplosion(rocket.lastPos.x, rocket.lastPos.y); // Use rocket's last pos
                rocket.isActive = false; // Deactivate rocket visually
                // Don't splice here, let the main rocket update loop handle removal
            }
        }

        // --- Arrow Collisions (Original Logic) ---
        for (let i = this.activeArrows.length - 1; i >= 0; i--) {
            const arrow = this.activeArrows[i];
            // Skip arrows that are already stuck or inactive from previous frames
            if (!arrow.isActive || arrow.state === ArrowState.STUCK) continue; // Use Enum member

            let stuckThisIteration = false; 
            const tip = arrow.getTipPosition(); // Assuming this method exists on Arrow

            // Check arrow tip collision with players
            for (const player of players) {
                if (arrow.owner === player) continue; // Don't collide with self

                const head = player.getHeadCircle();
                const body = player.getBodyRect();
                let hitDetected = false;

                // Check tip vs Head (Point vs Circle)
                const dxHead = tip.x - head.x;
                const dyHead = tip.y - head.y;
                if ((dxHead * dxHead + dyHead * dyHead) < (head.radius * head.radius)) {
                    console.log(`Arrow hit Player ${player === this.player1 ? 1 : 2} head (Tip Check)`);
                    hitDetected = true;
                }
                // Check tip vs Body (Point vs Rect)
                else if (tip.x >= body.x && tip.x <= body.x + body.width &&
                         tip.y >= body.y && tip.y <= body.y + body.height) {
                    console.log(`Arrow hit Player ${player === this.player1 ? 1 : 2} body (Tip Check)`);
                    hitDetected = true;
                }

                if (hitDetected) {
                    // Stick arrow based on tip position
                    arrow.stick(player, tip.x, tip.y); // Assuming stick method exists
                    // Apply damage/effect to player
                    player.startItching(); // Example effect
                    const angle = Math.atan2(tip.y - player.y, tip.x - player.x); 
                    player.vx += Math.cos(angle) * C.ARROW_DAMAGE_FORCE;
                    player.vy += Math.sin(angle) * C.ARROW_DAMAGE_FORCE * 0.5 - 100; // Example force
                    audioManager.playSound('BODY_HIT_1'); 
                    stuckThisIteration = true; 
                    break; 
                }
            }
            
            // Only check ball if arrow didn't stick to a player
            if (!stuckThisIteration) {
                // Check arrow tip collision with Ball (Point vs Circle)
                const dxBall = tip.x - this.ball.x;
                const dyBall = tip.y - this.ball.y;
                if ((dxBall * dxBall + dyBall * dyBall) < (this.ball.radius * this.ball.radius)) {
                    // Store velocity IMMEDIATELY upon detecting hit
                    const impactVx = arrow.vx; 
                    const impactVy = arrow.vy;
                    console.log(`[GM] Arrow hit Ball. Stored Velocity: (${impactVx.toFixed(1)}, ${impactVy.toFixed(1)}) (Tip Check)`); 
                    
                    const forceMultiplier = 1.0; 
                    const forceX = impactVx * forceMultiplier;
                    const forceY = impactVy * forceMultiplier;
                    console.log(`[GM] Calculated Force to Apply: (${forceX.toFixed(1)}, ${forceY.toFixed(1)})`);
                    
                    // Apply force using the stored impact velocity
                    console.log(`[GM] Calling ball.applyForce...`);
                    this.ball.applyForce(forceX, forceY); // Use stored velocity
                    console.log(`[GM] Returned from ball.applyForce.`);
                    audioManager.playSound('BODY_HIT_1');
                    
                    // Now stick the arrow (use tip position for sticking point)
                    console.log(`[GM] Calling arrow.stick...`);
                    arrow.stick(this.ball, tip.x, tip.y); // Assuming stick method exists
                    console.log(`[GM] Returned from arrow.stick.`);
                    
                    stuckThisIteration = true; // Set flag
                }
            }
            
            // Check Arrow vs Ground (End Pos Check - Keep this simplified check)
             if (!stuckThisIteration && arrow.y >= C.GROUND_Y - (arrow['thickness'] / 2)) { // Assuming thickness exists
                 console.log("Arrow hit Ground (End Pos Check)");
                 arrow.stick('ground', arrow.x, C.GROUND_Y - (arrow['thickness'] / 2));
                 stuckThisIteration = true; 
             }
        }

        // --- Sword Collision Logic --- 
        for (const swinger of players) {
            if (!swinger.isSword || !swinger.isSwingingSword) continue; // Only check if swinging sword
            
            let stuckThisIteration = false; // Declare flag for this loop scope

            const swordShape = swinger.getSwordCollisionShape();
            if (!swordShape) continue; 

            // 1. Check Sword vs Other Player
            const targetPlayer = (swinger === this.player1) ? this.player2 : this.player1;
            if (!targetPlayer.isTumbling && !targetPlayer.isBeingPushedBack) { // Don't hit stunned/pushed players
                const targetHead = targetPlayer.getHeadCircle();
                const targetBody = targetPlayer.getBodyRect(); // Using rect for body

                let hitDetected = false;
                // Check sword line vs target head circle
                if (this.checkLineCircleCollision(swordShape.p1, swordShape.p2, targetHead)) {
                    console.log(`Sword hit Player ${targetPlayer === this.player1 ? 1 : 2} head!`);
                    hitDetected = true;
                }
                // Check sword line vs target body rectangle (APPROXIMATION: check line vs rect center+radius)
                // A true line-rect intersection is more complex. Let's use simpler circle approximation for body.
                else {
                    const bodyCenterX = targetBody.x + targetBody.width / 2;
                    const bodyCenterY = targetBody.y + targetBody.height / 2;
                    // Approximate body with a circle encompassing the rect
                    const bodyRadius = Math.max(targetBody.width, targetBody.height) / 1.8; // Slightly smaller than fully encompassing
                    const bodyCircle = { x: bodyCenterX, y: bodyCenterY, radius: bodyRadius };
                    
                    if (this.checkLineCircleCollision(swordShape.p1, swordShape.p2, bodyCircle)) {
                        console.log(`Sword hit Player ${targetPlayer === this.player1 ? 1 : 2} body!`);
                        hitDetected = true;
                    }
                }

                if (hitDetected) {
                    // Apply pushback effect
                    const pushDirectionX = Math.sign(targetPlayer.x - swinger.x) || 1; // Push away horizontally
                    const upwardForce = -300; // How much to bounce upwards (negative is up)

                    targetPlayer.vx = pushDirectionX * C.SWORD_HIT_FORCE; // Use constant for horizontal force
                    targetPlayer.vy = upwardForce; // Apply upward bounce
                    
                    // Use pushback state to prevent immediate input
                    targetPlayer.isBeingPushedBack = true;
                    targetPlayer.pushbackTimer = C.PUSHBACK_DURATION; // Use standard duration for now
                    
                    // Reset jumping/platform states
                    targetPlayer.isJumping = true; 
                    targetPlayer.onOtherPlayerHead = false;
                    targetPlayer.onLeftCrossbar = false;
                    targetPlayer.onRightCrossbar = false;
                    
                    targetPlayer.startTumble(); // Make them tumble
                    
                    // Play the correct sword hit sound
                    audioManager.playSound('SWORD_HIT'); 
                }
            }

            // 2. Check Sword vs Ball
            const ballCircle = { x: this.ball.x, y: this.ball.y, radius: this.ball.radius };
            // Log sword and ball positions just before the check
            console.log(`[Sword Check] Sword: p1=(${swordShape.p1.x.toFixed(1)},${swordShape.p1.y.toFixed(1)}), p2=(${swordShape.p2.x.toFixed(1)},${swordShape.p2.y.toFixed(1)}) | Ball: cx=${ballCircle.x.toFixed(1)}, cy=${ballCircle.y.toFixed(1)}, r=${ballCircle.radius.toFixed(1)}`);
            
            if (this.checkLineCircleCollision(swordShape.p1, swordShape.p2, ballCircle)) {
                 // console.log("Sword hit Ball! DETECTED."); // REMOVE THIS LOG
                 
                 const swordAngle = Math.atan2(swordShape.p2.y - swordShape.p1.y, swordShape.p2.x - swordShape.p1.x);
                 const forceMagnitude = C.SWORD_BALL_FORCE;
                 const forceX = Math.cos(swordAngle) * forceMagnitude;
                 const forceY = Math.sin(swordAngle) * forceMagnitude;
                 // console.log(`[Sword Hit Ball] Applying force: angle=${swordAngle.toFixed(2)}, mag=${forceMagnitude}`); // REMOVE THIS LOG
                 this.ball.applyForce(forceX, forceY);
                 audioManager.playSound('SWORD_HIT_BALL');
                 stuckThisIteration = true; // Prevent other collisions this frame for the ball
            }
            
            // Add ground check for sword? Probably not needed.
        }
        // --------------------------------------------
    }

    // Helper function for simple rectangle collision
    private checkRectCollision(rect1: any, rect2: any): boolean {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    // Helper function for feet-on-head collision
    private checkFeetOnHeadCollision(feetPlayer: Player, headPlayer: Player): boolean {
        const head = headPlayer.getHeadCircle();
        const feetX = feetPlayer.x;
        const feetY = feetPlayer.y; // Player y is feet position
        const headTopY = head.y - head.radius;
        const headCenterY = head.y; 
        const headLeftX = head.x - head.radius; 
        const headRightX = head.x + head.radius;

        // Check if feet are horizontally within head bounds
        // Check if feet are vertically between head top and slightly below center
        // Check if the feet player is falling or stationary vertically
        return (
            feetX >= headLeftX &&
            feetX <= headRightX &&
            feetY >= headTopY &&
            feetY <= headCenterY + 5 && // Allow slightly below center
            feetPlayer.vy >= 0 
        );
    }

    /**
     * Checks for collision between a circle and a rectangle.
     * @param circle - Object with x, y, radius properties.
     * @param rect - Object with x, y, width, height properties.
     */
    private checkCircleRectCollision(circle: { x: number, y: number, radius: number }, rect: { x: number, y: number, width: number, height: number }): boolean {
        // Find the closest point to the circle within the rectangle
        const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

        // Calculate the distance between the circle's center and this closest point
        const distanceX = circle.x - closestX;
        const distanceY = circle.y - closestY;

        // If the distance is less than the circle's radius, an overlap occurs
        const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
        return distanceSquared < (circle.radius * circle.radius);
    }

    /**
     * Checks for collision between a line segment and a circle.
     * Used for more robust arrow collision to prevent tunneling.
     * @param p1 - Start point of the line segment { x, y }.
     * @param p2 - End point of the line segment { x, y }.
     * @param circle - The circle object { x, y, radius }.
     * @returns True if they collide, false otherwise.
     */
    private checkLineCircleCollision(p1: { x: number, y: number }, p2: { x: number, y: number }, circle: { x: number, y: number, radius: number }): boolean {
        const lenSq = (p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y);
        // Handle degenerate line (start == end)
        if (lenSq === 0) {
            const dx = circle.x - p1.x;
            const dy = circle.y - p1.y;
            return dx * dx + dy * dy <= circle.radius * circle.radius;
        }

        // Project circle center onto the line
        let t = ((circle.x - p1.x) * (p2.x - p1.x) + (circle.y - p1.y) * (p2.y - p1.y)) / lenSq;
        t = Math.max(0, Math.min(1, t)); // Clamp t to the segment [0, 1]

        // Find the closest point on the line segment to the circle center
        const closestX = p1.x + t * (p2.x - p1.x);
        const closestY = p1.y + t * (p2.y - p1.y);

        // Check distance from circle center to this closest point
        const distX = circle.x - closestX;
        const distY = circle.y - closestY;
        const distSq = distX * distX + distY * distY;

        return distSq <= circle.radius * circle.radius;
    }

    private applyPowerup(player: Player, type: PowerupType): void {
        console.log(`Applying powerup ${type} to player ${player === this.player1 ? 1 : 2}...`);
        
        switch (type) {
            case PowerupType.SPEED_BOOST:
                player.activateSpeedBoost(); 
                break;
            case PowerupType.BIG_PLAYER:
                player.activateBigPlayer();
                break;
            case PowerupType.SUPER_JUMP:
                player.activateSuperJump();
                break;
            case PowerupType.BALL_FREEZE:
                // Ensure the freeze method is actually called
                console.log("Calling ball.freeze()"); // Add log before call
                this.ball.freeze(C.POWERUP_BALL_FREEZE_DURATION);
                break;
            case PowerupType.ROCKET_LAUNCHER:
                { // Use block scope for constants
                    const ammoToAdd = 3; // Or C.ROCKET_LAUNCHER_AMMO_GIVEN
                    const wasAlreadyEquipped = player.hasRocketLauncher;

                    if (wasAlreadyEquipped) {
                        player.rocketAmmo += ammoToAdd;
                    } else {
                        player.hasRocketLauncher = true;
                        player.rocketAmmo = ammoToAdd; // Set initial ammo
                    }
                    
                    console.log(`Player ${player === this.player1 ? 1 : 2} ${wasAlreadyEquipped ? 'added' : 'picked up'} Rocket Launcher (Ammo: ${player.rocketAmmo})`);
                    // TODO: Add sound effect for pickup
                    break;
                }
            case PowerupType.BOW:
                // If player already has a rocket launcher, remove it
                if (player.hasRocketLauncher) {
                    player.hasRocketLauncher = false;
                    player.rocketAmmo = 0;
                }
                // Also remove sword if picking up bow
                if (player.isSword) {
                    player.isSword = false;
                }
                // Check if player already has bow
                const hadBowAlready = player.hasBow;
                player.hasBow = true;
                if (hadBowAlready) {
                    player.arrowAmmo += 3; // Add ammo if already had bow
                } else {
                    player.arrowAmmo = 3; // Set initial ammo
                }
                player.aimAngle = 0; // Reset aim angle on pickup
                console.log(`Player ${player === this.player1 ? 1 : 2} ${hadBowAlready ? 'added arrows to' : 'picked up'} Bow (Ammo: ${player.arrowAmmo})`);
                // TODO: Add sound effect for bow pickup
                break;
            case PowerupType.SWORD: // New case for Sword
                // Remove other weapons when picking up sword
                if (player.hasRocketLauncher) {
                    player.hasRocketLauncher = false;
                    player.rocketAmmo = 0;
                }
                if (player.hasBow) {
                    player.hasBow = false;
                    player.arrowAmmo = 0;
                }
                player.isSword = true; // Equip sword
                console.log(`Player ${player === this.player1 ? 1 : 2} picked up Sword`);
                 // TODO: Add sound effect for sword pickup
                break;
            case PowerupType.GOAL_ENLARGE: // New case
                // Enlarge the OPPONENT'S goal
                if (player === this.player1) { // Player 1 picked it up
                    this.isPlayer2GoalEnlarged = true;
                    this.player2GoalEnlargeTimer = C.POWERUP_GOAL_ENLARGE_DURATION;
                    console.log("Player 2 goal enlarged!");
                } else { // Player 2 picked it up
                    this.isPlayer1GoalEnlarged = true;
                    this.player1GoalEnlargeTimer = C.POWERUP_GOAL_ENLARGE_DURATION;
                    console.log("Player 1 goal enlarged!");
                }
                // TODO: Add sound effect for goal enlarge pickup
                break;
            // Add other cases later
            default:
                console.warn(`Unhandled powerup type: ${type}`);
        }
    }

    private update(dt: number): void {
        this.inputHandler.update(); 

        // --- Update Power-up Timers --- 
        if (this.isPlayer1GoalEnlarged && this.player1GoalEnlargeTimer > 0) {
            this.player1GoalEnlargeTimer -= dt;
            if (this.player1GoalEnlargeTimer <= 0) {
                this.isPlayer1GoalEnlarged = false;
                console.log("Player 1 goal back to normal size.");
            }
        }
         if (this.isPlayer2GoalEnlarged && this.player2GoalEnlargeTimer > 0) {
            this.player2GoalEnlargeTimer -= dt;
            if (this.player2GoalEnlargeTimer <= 0) {
                this.isPlayer2GoalEnlarged = false;
                console.log("Player 2 goal back to normal size.");
            }
        }
        // TODO: Add timer updates for Goal Shield

        // --- Handle Match Over Reset Listener --- 
        // Separate listener for match over state to prevent conflict with game start
        if (this.currentState === C.GameState.MATCH_OVER && this.matchOverTimer <= 0 && !this.isMatchOverListenerActive) {
            console.log("Match Over timer ended. Waiting for Enter to restart...");
            this.addMatchOverRestartListener();
        }
        // --- End Match Over Reset Listener ---

        switch (this.currentState) {
            case C.GameState.WELCOME:
                // Check for any key press to start
                // A simple way: check if any relevant key is down
                if (this.inputHandler.isKeyPressed(C.Player1Controls.JUMP) || 
                    this.inputHandler.isKeyPressed(C.Player1Controls.KICK) ||
                    this.inputHandler.isKeyPressed(C.Player2Controls.JUMP) ||
                    this.inputHandler.isKeyPressed(C.Player2Controls.KICK)) {
                    this.startNewMatch(); // Start the first match
                }
                break;
            case C.GameState.PLAYING:
                
                // --- Handle Auto-Aim Sway (Moved Before Input) --- 
                const currentTime = performance.now() / 1000; // Get time in seconds
                const swayPhase = currentTime * C.BOW_SWAY_SPEED * Math.PI * 2; // Use C. constant
                const swayAngle = Math.sin(swayPhase) * C.BOW_SWAY_ANGLE_MAX; // Use C. constant

                // Apply sway to Player 1 if they have a bow and are relatively idle
                if (this.player1.hasBow && !this.player1.isKicking && !this.player1.isStunned && !this.player1.isTumbling) {
                    // Negate the angle to fix the inverted aim issue
                    this.player1.aimAngle = -swayAngle;
                } else if (!this.player1.hasBow) {
                     this.player1.aimAngle = 0; // Reset angle if bow is lost
                }
                // Apply sway to Player 2
                if (this.player2.hasBow && !this.player2.isKicking && !this.player2.isStunned && !this.player2.isTumbling) {
                    // Negate the angle to fix the inverted aim issue
                    this.player2.aimAngle = -swayAngle;
                } else if (!this.player2.hasBow) {
                     this.player2.aimAngle = 0; // Reset angle if bow is lost
                }
                // --- End Auto-Aim Sway ---

                // --- Handle Player Input --- 
                // Player 1 Movement Input (Unaffected by bow)
                let p1EffectiveSpeed = this.player1.playerSpeed * this.player1.speedMultiplier;
                if (!this.player1.isBeingPushedBack) {
                    if (this.inputHandler.isKeyPressed(C.Player1Controls.LEFT)) {
                        this.player1.vx = -p1EffectiveSpeed;
                        this.player1.facingDirection = -1;
                    } else if (this.inputHandler.isKeyPressed(C.Player1Controls.RIGHT)) {
                        this.player1.vx = p1EffectiveSpeed;
                        this.player1.facingDirection = 1;
                    } else {
                        this.player1.vx = 0;
                    }
                }
                // Player 1 Jump Input (Unaffected by bow)
                if (this.inputHandler.wasKeyJustPressed(C.Player1Controls.JUMP)) {
                    this.player1.jump();
                }
                // Player 1 Kick/Fire Input
                if (this.inputHandler.wasKeyJustPressed(C.Player1Controls.KICK)) {
                    const currentTime = performance.now();
                    const timeSinceLastKick = currentTime - this.player1LastKickTime;

                    // Check for double tap FIRST
                    if (this.player1LastKickTime > 0 && timeSinceLastKick < DOUBLE_TAP_THRESHOLD_MS) {
                        // Double tap detected! Only perform bicycle kick actions.
                        console.log("Player 1 Bicycle Kick!");
                        this.player1.isKicking = false; // Ensure standard kick is false
                        this.player1.kickTimer = 0;
                        this.player1.startBicycleKick(); // Directly start bicycle kick
                        this.player1LastKickTime = 0; // Prevent immediate re-trigger
                    } else {
                        // Single tap (or first tap after reset/start)
                        // --- Prioritize Weapon Actions --- 
                        let actionTaken = false;
                        if (this.player1.isSword) {
                            this.player1.startSwordSwing();
                            actionTaken = true; // Sword swing takes priority
                        }
                        if (!actionTaken && this.player1.hasRocketLauncher && !this.player1.isItching) {
                            const newRocket = this.player1.fireRocket(this.particleSystem);
                            if (newRocket) this.activeRockets.push(newRocket);
                            actionTaken = true; // Rocket fired
                        }
                        if (!actionTaken && this.player1.hasBow && !this.player1.isItching) {
                            if (this.player1.arrowAmmo > 0) {
                                // --- Fire Arrow Logic ---
                                const arrowSpeed = C.ARROW_SPEED;
                                const worldAimAngle = -this.player1.aimAngle;
                                const effectiveFireAngle = this.player1.facingDirection === 1 ? worldAimAngle : Math.PI - worldAimAngle;
                                const vx = Math.cos(effectiveFireAngle) * arrowSpeed;
                                const vy = -Math.sin(effectiveFireAngle) * arrowSpeed;
                                const startX = this.player1.x;
                                const startY = this.player1.y - this.player1.legLength - this.player1.torsoLength * 0.5;
                                const newArrow = new Arrow(startX, startY, vx, vy, this.player1, this.particleSystem);
                                this.activeArrows.push(newArrow);
                                this.player1.arrowAmmo--;
                                if (this.player1.arrowAmmo <= 0) {
                                    this.player1.hasBow = false;
                                }
                                audioManager.playSound('KICK_1'); // Placeholder
                            } else { console.log("Player 1 out of arrows!"); }
                            actionTaken = true; // Arrow fired or attempted
                        }
                        // --- Fallback to Standard Kick --- 
                        if (!actionTaken) {
                            this.player1.startKick();
                        }
                        
                        // Always record the time of this kick attempt
                        this.player1LastKickTime = currentTime;
                    }
                }

                // Player 2 Movement Input (Unaffected by bow)
                let p2EffectiveSpeed = this.player2.playerSpeed * this.player2.speedMultiplier;
                if (!this.player2.isBeingPushedBack) {
                    if (this.inputHandler.isKeyPressed(C.Player2Controls.LEFT)) {
                        this.player2.vx = -p2EffectiveSpeed;
                        this.player2.facingDirection = -1;
                    } else if (this.inputHandler.isKeyPressed(C.Player2Controls.RIGHT)) {
                        this.player2.vx = p2EffectiveSpeed;
                        this.player2.facingDirection = 1;
                    } else {
                        this.player2.vx = 0;
                    }
                }
                // Player 2 Jump Input (Unaffected by bow)
                if (this.inputHandler.wasKeyJustPressed(C.Player2Controls.JUMP)) {
                    this.player2.jump();
                }
                // Player 2 Kick/Fire Input
                if (this.inputHandler.wasKeyJustPressed(C.Player2Controls.KICK)) {
                    const currentTime = performance.now();
                    const timeSinceLastKick = currentTime - this.player2LastKickTime;

                    // Check for double tap FIRST
                    if (this.player2LastKickTime > 0 && timeSinceLastKick < DOUBLE_TAP_THRESHOLD_MS) {
                        // Double tap detected! Only perform bicycle kick actions.
                        console.log("Player 2 Bicycle Kick!");
                        this.player2.isKicking = false; // Ensure standard kick is false
                        this.player2.kickTimer = 0;
                        this.player2.startBicycleKick(); // Directly start bicycle kick
                        this.player2LastKickTime = 0; // Prevent immediate re-trigger
                    } else {
                        // Single tap (or first tap after reset/start)
                        // --- Prioritize Weapon Actions --- 
                        let actionTaken = false;
                         if (this.player2.isSword) {
                            this.player2.startSwordSwing();
                            actionTaken = true; // Sword swing takes priority
                        }
                        if (!actionTaken && this.player2.hasRocketLauncher && !this.player2.isItching) {
                            const newRocket = this.player2.fireRocket(this.particleSystem);
                            if (newRocket) this.activeRockets.push(newRocket);
                             actionTaken = true; // Rocket fired
                        }
                        if (!actionTaken && this.player2.hasBow && !this.player2.isItching) {
                            if (this.player2.arrowAmmo > 0) {
                                // --- Fire Arrow Logic ---
                                const arrowSpeed = C.ARROW_SPEED;
                                const worldAimAngle = -this.player2.aimAngle;
                                const effectiveFireAngle = this.player2.facingDirection === 1 ? worldAimAngle : Math.PI - worldAimAngle;
                                const vx = Math.cos(effectiveFireAngle) * arrowSpeed;
                                const vy = -Math.sin(effectiveFireAngle) * arrowSpeed;
                                const startX = this.player2.x;
                                const startY = this.player2.y - this.player2.legLength - this.player2.torsoLength * 0.5;
                                const newArrow = new Arrow(startX, startY, vx, vy, this.player2, this.particleSystem);
                                this.activeArrows.push(newArrow);
                                this.player2.arrowAmmo--;
                                if (this.player2.arrowAmmo <= 0) {
                                    this.player2.hasBow = false;
                                }
                                audioManager.playSound('KICK_1'); // Placeholder
                            } else { console.log("Player 2 out of arrows!"); }
                             actionTaken = true; // Arrow fired or attempted
                        }
                        // --- Fallback to Standard Kick --- 
                        if (!actionTaken) {
                             this.player2.startKick();
                        }

                        // Always record the time of this kick attempt
                        this.player2LastKickTime = currentTime;
                    }
                }

                // --- Debug Keys ---
                // DEBUG: Spawn Rocket Launcher on '1' key press
                if (this.inputHandler.wasKeyJustPressed('1')) {
                    this.spawnSpecificPowerup(PowerupType.ROCKET_LAUNCHER, C.SCREEN_WIDTH / 2, 50);
                }
                // DEBUG: Toggle Player 1 Itching on '2' key press
                if (this.inputHandler.wasKeyJustPressed('2')) {
                    this.player1.isItching = !this.player1.isItching;
                    console.log(`DEBUG: Toggled Player 1 itching: ${this.player1.isItching}`);
                }
                // DEBUG: Spawn Bow Powerup on '3' key press
                if (this.inputHandler.wasKeyJustPressed('3')) {
                    this.spawnSpecificPowerup(PowerupType.BOW, C.SCREEN_WIDTH / 2, 50);
                    console.log("DEBUG: Spawned Bow Powerup");
                }
                // DEBUG: Toggle Player 1 Sword on '4' key press
                if (this.inputHandler.wasKeyJustPressed('4')) {
                    this.player1.isSword = !this.player1.isSword;
                    // Ensure other weapons are removed if sword is equipped
                    if (this.player1.isSword) {
                        this.player1.hasBow = false;
                        this.player1.hasRocketLauncher = false;
                    }
                    console.log(`DEBUG: Toggled Player 1 Sword: ${this.player1.isSword}`);
                }
                
                // Emit jump particles (outside the key press check, triggered by Player state)
                if (this.player1.isJumping && !this.player1.hasJumpedThisPress) {
                    // console.log("GameManager: Emitting jump particles for P1"); // DEBUG LOG
                    this.particleSystem.emit('jump', this.player1.x, this.player1.y, 6, { scale: this.player1.sizeMultiplier });
                    this.player1.hasJumpedThisPress = true; // Ensure particle only emits once per jump press
                }
                if (this.player2.isJumping && !this.player2.hasJumpedThisPress) {
                     // console.log("GameManager: Emitting jump particles for P2"); // DEBUG LOG
                     this.particleSystem.emit('jump', this.player2.x, this.player2.y, 6, { scale: this.player2.sizeMultiplier });
                     this.player2.hasJumpedThisPress = true; // Ensure particle only emits once per jump press
                }

                // Update Entities
                this.player1.update(dt, C.GROUND_Y, C.SCREEN_WIDTH);
                if (this.player1.justLanded) {
                    this.particleSystem.emit('landingDust', this.player1.x, this.player1.y, 12, 
                        { scale: this.player1.sizeMultiplier, landingVelocity: this.player1.lastLandingVy });
                    this.player1.justLanded = false; // Reset flag immediately after use
                }
                this.player2.update(dt, C.GROUND_Y, C.SCREEN_WIDTH);
                 if (this.player2.justLanded) {
                    this.particleSystem.emit('landingDust', this.player2.x, this.player2.y, 12, 
                        { scale: this.player2.sizeMultiplier, landingVelocity: this.player2.lastLandingVy });
                    this.player2.justLanded = false; // Reset flag immediately after use
                }

                // Update Powerups
                this.powerupManager.update(dt);

                // Update Active Rockets (Check isActive after update)
                for (let i = this.activeRockets.length - 1; i >= 0; i--) {
                    const rocket = this.activeRockets[i];
                    rocket.update(dt); // Update rocket physics/state
                    // If rocket exploded/went OOB, its update should set isActive = false
                    if (!rocket.isActive) {
                        // If it was an explosion, createExplosion should have been called already
                        this.activeRockets.splice(i, 1); 
                    }
                }
                
                // Update Active Arrows (Physics Only)
                for (let i = this.activeArrows.length - 1; i >= 0; i--) {
                    const arrow = this.activeArrows[i];
                    arrow.update(dt); // Update arrow physics (gravity, position)
                    // Check for inactivity (out of bounds)
                    if (!arrow.isActive) {
                        console.log("Removing inactive arrow (OOB) from GameManager list.");
                        this.activeArrows.splice(i, 1);
                    }
                }
                
                // *** Handle Collisions BEFORE updating the ball ***
                this.handleCollisions(); // Handles player-player, player-ball, arrow hits, etc. Applies forces.

                // Update Ball (NOW uses velocity possibly modified by handleCollisions)
                this.ball.update(dt);
                
                // Update Particles AFTER entities and ball have moved
                this.particleSystem.update(dt); 
                
                // Check Goal AFTER ball position is updated
                this.checkGoal();
                break;
            case C.GameState.GOAL_SCORED:
                this.goalMessageTimer -= dt;
                if (this.goalMessageTimer <= 0) {
                    this.resetPositions(); // Reset after delay
                    this.currentState = C.GameState.PLAYING; // Resume playing
                }
                // Keep updating particles during goal celebration
                this.particleSystem.update(dt);
                break;
            case C.GameState.MATCH_OVER:
                this.matchOverTimer -= dt;
                if (this.matchOverTimer <= 0) {
                    // Don't reset immediately - wait for the Enter key press
                    // Logic to add the listener is now handled outside the switch
                }
                 // Keep updating particles during match over
                 this.particleSystem.update(dt);
                break;
            // Add other states if needed (PAUSED, GAME_OVER, etc.)
        }

        // this.inputHandler.clearJustPressed(); // REMOVED: InputHandler.update() already handles this at the start
    }

    // --- Add helper methods for Match Over listener ---
    private isMatchOverListenerActive: boolean = false;

    private handleMatchOverKeyPress = (event: KeyboardEvent) => {
        // Check for Enter, P1 Kick ('s'), or P2 Kick ('arrowdown')
        const key = event.key.toLowerCase(); // Ensure lowercase check
        if (key === 'enter' || key === 's' || key === 'arrowdown') {
            console.log(`Restart key pressed (${event.key}) after Match Over. Restarting game...`);
            this.startNewMatch(); // Reset scores and start playing
            this.removeMatchOverRestartListener(); // Clean up listener
        }
    };

    private addMatchOverRestartListener(): void {
        if (!this.isMatchOverListenerActive) {
            document.addEventListener('keydown', this.handleMatchOverKeyPress);
            this.isMatchOverListenerActive = true;
        }
    }

    private removeMatchOverRestartListener(): void {
        if (this.isMatchOverListenerActive) {
            document.removeEventListener('keydown', this.handleMatchOverKeyPress);
            this.isMatchOverListenerActive = false;
        }
    }
    // --- End helper methods ---

    private render(): void {
        // Clear canvas
        this.ctx.clearRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);

        // Draw Background (Example: Light Blue Sky)
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);

        // Draw Ground
        this.ctx.fillStyle = '#228B22'; // Forest Green
        this.ctx.fillRect(0, C.GROUND_Y, C.SCREEN_WIDTH, C.SCREEN_HEIGHT - C.GROUND_Y);

        // Draw Goals
        this.drawGoals();

        // Draw Ball
        this.ball.draw(this.ctx);

        // Draw Players
        this.player1.draw(this.ctx);
        this.player2.draw(this.ctx);

        // Draw Player Weapon Status Text (REMOVED)
        /*
        this.ctx.fillStyle = C.WHITE;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        // Calculate Y position reliably above the head
        const textOffsetY = 15; // Pixels above the head
        const p1TextY = this.player1.y - this.player1.legLength - this.player1.torsoLength - this.player1.headRadius * 2 - textOffsetY;
        const p2TextY = this.player2.y - this.player2.legLength - this.player2.torsoLength - this.player2.headRadius * 2 - textOffsetY;

        if (this.player1.hasBow) {
            this.ctx.fillText('Bow Active', this.player1.x, p1TextY);
        } else if (this.player1.hasRocketLauncher) {
            this.ctx.fillText(`Rockets: ${this.player1.rocketAmmo}`, this.player1.x, p1TextY);
        }
        if (this.player2.hasBow) {
            this.ctx.fillText('Bow Active', this.player2.x, p2TextY);
        } else if (this.player2.hasRocketLauncher) {
            this.ctx.fillText(`Rockets: ${this.player2.rocketAmmo}`, this.player2.x, p2TextY);
        }
        */

        // Draw Powerups
        this.powerupManager.draw(this.ctx);

        // Draw Rockets
        for (const rocket of this.activeRockets) {
            rocket.draw(this.ctx);
        }
        
        // Draw Arrows
        for (const arrow of this.activeArrows) {
            arrow.draw(this.ctx);
        }

        this.particleSystem.draw(this.ctx);

        // Draw UI using UIManager
        // console.log(`GameManager render: ball.isFrozen=${this.ball.isFrozen}, ball.freezeTimer=${this.ball['freezeTimer']?.toFixed(2)}`); // DEBUG LOG
        const uiState: UIGameState = {
            currentState: this.currentState,
            player1Score: this.player1Score,
            player2Score: this.player2Score,
            // Player 1 timers/state
            p1SpeedBoostTimer: this.player1['speedBoostTimer'],
            p1SuperJumpTimer: this.player1['superJumpTimer'],
            p1BigPlayerTimer: this.player1['bigPlayerTimer'],
            p1HasRocketLauncher: this.player1.hasRocketLauncher,
            p1RocketAmmo: this.player1.rocketAmmo,
            p1HasBow: this.player1.hasBow,
            p1ArrowAmmo: this.player1.arrowAmmo,
            player1GoalEnlargeTimer: this.player1GoalEnlargeTimer, // Pass timer
            // Player 2 timers/state
            p2SpeedBoostTimer: this.player2['speedBoostTimer'],
            p2SuperJumpTimer: this.player2['superJumpTimer'],
            p2BigPlayerTimer: this.player2['bigPlayerTimer'],
            p2HasRocketLauncher: this.player2.hasRocketLauncher,
            p2RocketAmmo: this.player2.rocketAmmo,
            p2HasBow: this.player2.hasBow,
            p2ArrowAmmo: this.player2.arrowAmmo,
            player2GoalEnlargeTimer: this.player2GoalEnlargeTimer, // Pass timer
            // Global state
            ballIsFrozen: this.ball.isFrozen,
            ballFreezeTimer: this.ball['freezeTimer'],
            // Timers for UI messages (already passed)
            goalMessageTimer: this.goalMessageTimer,
            matchOverTimer: this.matchOverTimer
            // Pass winner info if needed later
        };
        this.uiManager.draw(uiState);

        // Draw Goal Message ONLY if Goal Scored and NOT Match Over
        if (this.currentState === C.GameState.GOAL_SCORED) { // No need to check timer, just state
            this.ctx.fillStyle = C.YELLOW; // Example color
            this.ctx.font = '60px Impact';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("GOAL!", C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 3);
        }
        // Draw Match Over Message (this takes precedence over Goal message if state is MATCH_OVER)
        else if (this.currentState === C.GameState.MATCH_OVER) {
            this.ctx.fillStyle = C.WHITE;
            this.ctx.font = '50px Arial';
            this.ctx.textAlign = 'center';
            const winnerName = this.player1Score >= MATCH_POINT_LIMIT ? "Nils" : "Harry"; // Use names
            this.ctx.fillText(`${winnerName} Wins!`, C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 2 - 30); // Simplified message
            this.ctx.font = '30px Arial';
            this.ctx.fillText(`Score: ${this.player1Score} - ${this.player2Score}`, C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 2 + 20);
            // Add restart prompt after timer expires
            if (this.matchOverTimer <= 0) {
                 this.ctx.font = '25px Arial';
                 this.ctx.fillStyle = C.YELLOW; // Highlight prompt
                 this.ctx.fillText(`Press Enter or Kick (S / ↓) to Play Again`, C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 2 + 70);
            }
        }
    }

    private gameLoop(timestamp: number): void {
        const deltaTime = (timestamp - this.lastTime) / 1000; // Time since last frame in seconds
        this.lastTime = timestamp;

        this.accumulatedTime += deltaTime;

        // Fixed update loop
        while (this.accumulatedTime >= this.timeStep) {
            this.update(this.timeStep);
            this.accumulatedTime -= this.timeStep;
        }

        this.render();

        requestAnimationFrame(this.gameLoop.bind(this));
    }

    public start(): void {
        console.log("Starting game...");
        this.lastTime = performance.now();
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    private drawGoals(): void {
        const goalColor = C.GOAL_COLOR;
        this.ctx.fillStyle = goalColor;
        this.ctx.strokeStyle = C.BLACK;
        this.ctx.lineWidth = 2;

        // --- Calculate Effective Goal Dimensions --- 
        const enlargeFactor = C.POWERUP_GOAL_ENLARGE_FACTOR;

        // Player 1 Goal (Left)
        const p1GoalWidth = this.isPlayer1GoalEnlarged ? C.GOAL_WIDTH * enlargeFactor : C.GOAL_WIDTH;
        const p1GoalHeight = this.isPlayer1GoalEnlarged ? C.GOAL_HEIGHT * enlargeFactor : C.GOAL_HEIGHT;
        const p1GoalX = C.LEFT_GOAL_X; // X position doesn't change (anchored left)
        const p1GoalY = C.GROUND_Y - p1GoalHeight; // Y position adjusts based on height

        // Player 2 Goal (Right)
        const p2GoalWidth = this.isPlayer2GoalEnlarged ? C.GOAL_WIDTH * enlargeFactor : C.GOAL_WIDTH;
        const p2GoalHeight = this.isPlayer2GoalEnlarged ? C.GOAL_HEIGHT * enlargeFactor : C.GOAL_HEIGHT;
        const p2GoalX = C.RIGHT_GOAL_X - (p2GoalWidth - C.GOAL_WIDTH); // X pos adjusts based on width change
        const p2GoalY = C.GROUND_Y - p2GoalHeight; // Y position adjusts based on height
        // -----------------------------------------

        // Draw Nets First (adjust dimensions)
        this.ctx.strokeStyle = 'rgba(240, 240, 240, 0.8)';
        this.ctx.lineWidth = 1;
        const netSpacing = 10;

        // Left Goal Net (using p1 effective dimensions)
        for (let y = p1GoalY; y < C.GROUND_Y; y += netSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(p1GoalX, y);
            this.ctx.lineTo(p1GoalX + p1GoalWidth, y);
            this.ctx.stroke();
        }
        for (let x = p1GoalX; x < p1GoalX + p1GoalWidth; x += netSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, p1GoalY);
            this.ctx.lineTo(x, C.GROUND_Y);
            this.ctx.stroke();
        }

        // Right Goal Net (using p2 effective dimensions)
        for (let y = p2GoalY; y < C.GROUND_Y; y += netSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(p2GoalX, y);
            this.ctx.lineTo(p2GoalX + p2GoalWidth, y);
            this.ctx.stroke();
        }
        for (let x = p2GoalX; x < p2GoalX + p2GoalWidth; x += netSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, p2GoalY);
            this.ctx.lineTo(x, C.GROUND_Y);
            this.ctx.stroke();
        }

        // Draw Crossbars (using effective dimensions)
        this.ctx.fillStyle = goalColor;
        this.ctx.strokeStyle = C.BLACK;
        this.ctx.lineWidth = 2;
        // Left Crossbar
        const p1CrossbarY = p1GoalY - C.GOAL_POST_THICKNESS; // Adjust Y based on effective height
        this.ctx.fillRect(p1GoalX, p1CrossbarY, p1GoalWidth, C.GOAL_POST_THICKNESS);
        this.ctx.strokeRect(p1GoalX, p1CrossbarY, p1GoalWidth, C.GOAL_POST_THICKNESS);
        // Right Crossbar
        const p2CrossbarY = p2GoalY - C.GOAL_POST_THICKNESS; // Adjust Y based on effective height
        this.ctx.fillRect(p2GoalX, p2CrossbarY, p2GoalWidth, C.GOAL_POST_THICKNESS);
        this.ctx.strokeRect(p2GoalX, p2CrossbarY, p2GoalWidth, C.GOAL_POST_THICKNESS);

        // Draw Back Poles (using effective dimensions)
        // Left Back Pole
        this.ctx.fillRect(p1GoalX, p1GoalY, C.GOAL_POST_THICKNESS, p1GoalHeight);
        this.ctx.strokeRect(p1GoalX, p1GoalY, C.GOAL_POST_THICKNESS, p1GoalHeight);
        // Right Back Pole (adjust X position based on effective width)
        const p2BackPoleX = p2GoalX + p2GoalWidth - C.GOAL_POST_THICKNESS;
        this.ctx.fillRect(p2BackPoleX, p2GoalY, C.GOAL_POST_THICKNESS, p2GoalHeight);
        this.ctx.strokeRect(p2BackPoleX, p2GoalY, C.GOAL_POST_THICKNESS, p2GoalHeight);
    }

    private createExplosion(x: number, y: number): void {
        console.log(`Creating REAL Explosion at (${x.toFixed(0)}, ${y.toFixed(0)}) with radius ${C.ROCKET_BLAST_RADIUS}`);
        audioManager.playSound('ROCKET_EXPLODE_1'); // Ensure sound plays

        const players = [this.player1, this.player2];
        const blastRadiusSq = C.ROCKET_BLAST_RADIUS * C.ROCKET_BLAST_RADIUS;

        // Apply effects to Players
        players.forEach(player => {
            const dx = player.x - x;
            const dy = (player.y - player.torsoLength / 2) - y; // Use player torso center approx
            const distSq = dx * dx + dy * dy;

            if (distSq < blastRadiusSq) {
                console.log(`Player ${player === this.player1 ? 1 : 2} in blast radius!`);
                const dist = Math.sqrt(distSq);
                const forceScale = 1.0 - (dist / C.ROCKET_BLAST_RADIUS); // 1 at center, 0 at edge
                const forceMagnitude = C.ROCKET_EXPLOSION_FORCE * forceScale;
                
                let pushVecX = 0;
                let pushVecY = 0;
                if (dist > 0) { // Avoid division by zero if directly on top
                    pushVecX = dx / dist;
                    pushVecY = dy / dist;
                }
                 else { // Apply random direction if at epicenter
                    const randomAngle = Math.random() * Math.PI * 2;
                    pushVecX = Math.cos(randomAngle);
                    pushVecY = Math.sin(randomAngle);
                }

                // Add upward force (negative Y) and some horizontal pushback
                player.vy = C.EXPLOSION_UPWARD_FORCE + (pushVecY * 0.3); // Strong upward force + some outward push
                player.startTumble(); // Ensure player tumbles
            }
        });

        // Apply effects to Ball
        const dxBall = this.ball.x - x;
        const dyBall = this.ball.y - y;
        const distSqBall = dxBall * dxBall + dyBall * dyBall;

        if (distSqBall < blastRadiusSq) {
             console.log("Ball in blast radius!");
            const distBall = Math.sqrt(distSqBall);
            const forceScaleBall = 1.0 - (distBall / C.ROCKET_BLAST_RADIUS);
            const forceMagnitudeBall = C.ROCKET_EXPLOSION_FORCE * forceScaleBall; // Use same base force?

             let pushVecXBall = 0;
             let pushVecYBall = 0;
             if (distBall > 0) {
                 pushVecXBall = dxBall / distBall;
                 pushVecYBall = dyBall / distBall;
             } else { // Apply random direction if at epicenter
                 const randomAngle = Math.random() * Math.PI * 2;
                 pushVecXBall = Math.cos(randomAngle);
                 pushVecYBall = Math.sin(randomAngle);
             }
            
            // Apply force to ball using its method
            this.ball.applyForce(pushVecXBall * forceMagnitudeBall, 
                                pushVecYBall * forceMagnitudeBall - C.ROCKET_BALL_UPWARD_BOOST);
        }
        
        // Emit Explosion Particles
        this.particleSystem.emit('explosion', x, y, 50, { radius: C.ROCKET_BLAST_RADIUS }); // Add explosion particle type

        // TODO: Refine visual/audio effects if needed
    }

    // New method to handle sequenced score announcement
    private announceScore(): void {
        // Increased delay MORE to allow sounds to finish AND clear debounce
        const soundSequenceDelay = 1100; // milliseconds delay (must be > debounceInterval in AudioManager)
        let soundsToPlay: string[] = [];

        let leaderKey: string | null = null;
        let leaderScoreKey: string | null = null;
        let trailerScoreKey: string | null = null;

        if (this.player1Score > this.player2Score) {
            leaderKey = 'NILS_AHEAD';
            leaderScoreKey = 'NUM_' + this.player1Score;
            trailerScoreKey = 'NUM_' + this.player2Score;
        } else if (this.player2Score > this.player1Score) {
            leaderKey = 'HARRY_AHEAD';
            leaderScoreKey = 'NUM_' + this.player2Score;
            trailerScoreKey = 'NUM_' + this.player1Score;
        } else {
            // Scores are tied - just play the numbers, maybe P1 score then P2 score
            leaderScoreKey = 'NUM_' + this.player1Score;
            trailerScoreKey = 'NUM_' + this.player2Score;
            // No leader announcement needed
        }

        // Construct sound key sequence, checking if score is within playable range (0-5)
        if (leaderKey) {
            soundsToPlay.push(leaderKey);
        }
        if (leaderScoreKey && parseInt(leaderScoreKey.split('_')[1]) <= 5) {
            soundsToPlay.push(leaderScoreKey);
        }
        // Always add the trailer score if it's valid, even if tied
        if (trailerScoreKey && parseInt(trailerScoreKey.split('_')[1]) <= 5) {
            soundsToPlay.push(trailerScoreKey);
        }

        // Play sounds sequentially using chained setTimeouts
        let currentDelay = 50; // Initial small delay after goal sound
        const playNextSound = (index: number) => {
            if (index < soundsToPlay.length) {
                const soundKey = soundsToPlay[index];
                setTimeout(() => {
                    console.log(`Playing score announcement sound: ${soundKey}`); // Log which sound is playing
                    audioManager.playSound(soundKey);
                    playNextSound(index + 1); // Schedule the next sound
                }, soundSequenceDelay); // Use the fixed delay between sounds
            }
        };

        // Start the sequence after the initial delay
        setTimeout(() => {
             playNextSound(0);
        }, currentDelay);
    }
}