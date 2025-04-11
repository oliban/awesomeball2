import * as C from './Constants';
import { InputHandler } from './InputHandler';
import { Player, setPlayerSoundFunction } from './Player';
import { Ball } from './Ball';
import { UIManager, UIGameState } from './UIManager';
import { PowerupManager } from './PowerupManager';
import { PowerupType } from './Powerup';
import { ParticleSystem } from './ParticleSystem';
import { Powerup } from './Powerup';

// Dummy sound function if needed by Player constructor/methods
const dummyPlaySound = (soundUrlArray: string[]) => { 
    // console.log("Sound play ignored for now:", soundUrlArray); 
};
setPlayerSoundFunction(dummyPlaySound); // Set the dummy function

// Add match point limit to constants if not already there
const MATCH_POINT_LIMIT = 5; // Example limit
const GOAL_RESET_DELAY = 1.5; // Seconds delay after goal

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

        // DEBUG: Spawn a Ball Freeze powerup immediately - REMOVED
        // const freezePowerup = new Powerup(PowerupType.BALL_FREEZE, C.SCREEN_WIDTH / 2, C.GROUND_Y - 150);
        // this.powerupManager.addPowerup(freezePowerup);
    }

    private resetPositions(): void {
        // Reset Ball
        this.ball.x = C.SCREEN_WIDTH / 2;
        this.ball.y = C.GROUND_Y - 100;
        this.ball.vx = 0;
        this.ball.vy = 0;

        // Reset Player 1
        this.player1.x = C.SCREEN_WIDTH * 0.25;
        this.player1.y = C.GROUND_Y;
        this.player1.vx = 0;
        this.player1.vy = 0;
        this.player1.facingDirection = 1;
        this.player1.isKicking = false;
        this.player1.isJumping = false;
        this.player1.isTumbling = false;
        // TODO: Reset other states like stun, powerups if needed

        // Reset Player 2
        this.player2.x = C.SCREEN_WIDTH * 0.75;
        this.player2.y = C.GROUND_Y;
        this.player2.vx = 0;
        this.player2.vy = 0;
        this.player2.facingDirection = -1;
        this.player2.isKicking = false;
        this.player2.isJumping = false;
        this.player2.isTumbling = false;
        // TODO: Reset other states like stun, powerups if needed

        this.particleSystem.clear(); // Clear particles on reset
    }

    private startNewMatch(): void {
        this.player1Score = 0;
        this.player2Score = 0;
        this.resetPositions();
        this.currentState = C.GameState.PLAYING;
        this.particleSystem.clear(); // Also clear particles here
    }

    private checkGoal(): void {
        // Only check for goals if playing
        if (this.currentState !== C.GameState.PLAYING) return;

        // Check if ball is within goal height
        if (this.ball.y > C.GOAL_Y_POS && this.ball.y < C.GROUND_Y) { 
            let goalScored = false;
            // Goal for Player 2 (Ball crossed left goal line)
            if (this.ball.x - this.ball.radius < C.GOAL_LINE_X_LEFT) {
                console.log("GOAL P2!");
                this.player2Score++;
                goalScored = true;
            } 
            // Goal for Player 1 (Ball crossed right goal line)
            else if (this.ball.x + this.ball.radius > C.GOAL_LINE_X_RIGHT) {
                console.log("GOAL P1!");
                this.player1Score++;
                goalScored = true;
            }
            if (goalScored) {
                // TODO: Add goal sound
                this.particleSystem.emit('goal', this.ball.x, this.ball.y, 50); // Emit goal particles
                this.currentState = C.GameState.GOAL_SCORED;
                this.goalMessageTimer = GOAL_RESET_DELAY; // Start delay timer

                // Check for Match Over
                if (this.player1Score >= MATCH_POINT_LIMIT || this.player2Score >= MATCH_POINT_LIMIT) {
                    this.currentState = C.GameState.MATCH_OVER;
                    this.matchOverTimer = 3.0; // Display match over message for 3 seconds
                    // TODO: Check for GAME_OVER later
                }
            }
        }
    }

    private handleCollisions(): void {
        if (this.currentState !== C.GameState.PLAYING) return;

        const players = [this.player1, this.player2];
        let kickAppliedThisFrame = false; 

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
                this.player1.vx = -p1vx * bounceFactor + p2vx * bounceFactor * 0.5; // Add some of other player's vel
                this.player2.vx = -p2vx * bounceFactor + p1vx * bounceFactor * 0.5;

                // Optional: Trigger tumble if collision is significant
                // (e.g., if relative velocity was high - simplify for now)
                // For simplicity, let's just trigger tumble on body collision for now
                // Avoid tumbling if already tumbling
                if (!this.player1.isTumbling) this.player1.startTumble();
                if (!this.player2.isTumbling) this.player2.startTumble(); 

                 console.log("Player-Player Body Collision");
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
            // --- Player-Ball Kick Collision ---
            if (player.isKicking && !kickAppliedThisFrame) {
                const kickPoint = player.getKickImpactPoint();
                if (kickPoint) {
                    const dx = this.ball.x - kickPoint.x;
                    const dy = this.ball.y - kickPoint.y;
                    const distSq = dx * dx + dy * dy;
                    const kickRadius = this.ball.radius + 30; // Increased kick collision radius further
                    const kickRadiusSq = kickRadius * kickRadius;

                    if (distSq < kickRadiusSq) {
                        console.log("Kick Connect!");
                        
                        // Calculate Momentum Boost (based on old logic)
                        const momentumScaleFactor = 0.4; // Percentage of player velocity to add
                        const momentumBoostVX = player.vx * momentumScaleFactor; 
                        const momentumBoostVY = player.vy * momentumScaleFactor;

                        // Base Kick Force (use constants, maybe increase them)
                        // Let's keep the 1.5x multiplier for now, adjust constants if needed
                        const baseKickVx = player.facingDirection * C.BASE_KICK_FORCE_X * 1.5; 
                        const baseKickVy = C.BASE_KICK_FORCE_Y * 1.5;
                        
                        // Combine Base and Momentum
                        const finalKickVx = baseKickVx + momentumBoostVX;
                        const finalKickVy = baseKickVy + momentumBoostVY;

                        console.log(`Kick Details: Base=(${baseKickVx.toFixed(0)}, ${baseKickVy.toFixed(0)}), Momentum=(${momentumBoostVX.toFixed(0)}, ${momentumBoostVY.toFixed(0)}), Final=(${finalKickVx.toFixed(0)}, ${finalKickVy.toFixed(0)})`);

                        // Apply the final combined force
                        this.ball.applyKick(finalKickVx, finalKickVy);
                        
                        this.particleSystem.emit('kick', kickPoint.x, kickPoint.y, 8, { kickDirection: player.facingDirection }); // Reduced count significantly (was 25)

                        kickAppliedThisFrame = true; 
                        // TODO: Add kick sound
                        continue; // Skip other ball collisions for this player if kick connects
                    }
                }
            }

            // --- Player-Ball Body/Head Collision ---
            // Simple Circle vs Circle (Head)
            const headCircle = player.getHeadCircle();
            const dxHead = this.ball.x - headCircle.x;
            const dyHead = this.ball.y - headCircle.y;
            const distSqHead = dxHead * dxHead + dyHead * dyHead;
            const radiiSumHeadSq = (this.ball.radius + headCircle.radius) * (this.ball.radius + headCircle.radius);

            if (distSqHead < radiiSumHeadSq) {
                console.log("Head Collision");
                const distHead = Math.sqrt(distSqHead) || 1;
                const overlapHead = (this.ball.radius + headCircle.radius) - distHead;
                
                // --- Positional Correction --- 
                const correctionFactor = 1.05; 
                const pushXHead = (dxHead / distHead) * overlapHead * correctionFactor;
                const pushYHead = (dyHead / distHead) * overlapHead * correctionFactor;
                this.ball.x += pushXHead; 
                this.ball.y += pushYHead;

                // --- Velocity Reflection (Bounce) --- 
                const normX = dxHead / distHead;
                const normY = dyHead / distHead;
                const dotProduct = this.ball.vx * normX + this.ball.vy * normY;
                
                // Only reflect if ball is moving towards the head
                if (dotProduct < 0) {
                    const impulseMagnitude = -(1 + C.BALL_BOUNCE * C.HEADBUTT_BOUNCE_FACTOR) * dotProduct;
                    this.ball.vx += impulseMagnitude * normX;
                    this.ball.vy += impulseMagnitude * normY;
                }
                // TODO: Add headbutt sound

                continue; // Prioritize headbutt over body if overlapping both
            }

            // Simple Rect vs Circle (Body)
            const bodyRect = player.getBodyRect();
            const closestX = Math.max(bodyRect.x, Math.min(this.ball.x, bodyRect.x + bodyRect.width));
            const closestY = Math.max(bodyRect.y, Math.min(this.ball.y, bodyRect.y + bodyRect.height));
            const dxBody = this.ball.x - closestX;
            const dyBody = this.ball.y - closestY;
            const distSqBody = dxBody * dxBody + dyBody * dyBody;

            if (distSqBody < this.ball.radius * this.ball.radius) {
                console.log("Body Collision");
                const distBody = Math.sqrt(distSqBody) || 1;
                const overlapBody = this.ball.radius - distBody;
                
                // --- Positional Correction ---
                const correctionFactorBody = 1.05;
                const pushXBody = (dxBody / distBody) * overlapBody * correctionFactorBody;
                const pushYBody = (dyBody / distBody) * overlapBody * correctionFactorBody;
                this.ball.x += pushXBody;
                this.ball.y += pushYBody;

                // --- Velocity Reflection (Bounce) ---
                const normXBody = dxBody / distBody;
                const normYBody = dyBody / distBody;
                const dotProductBody = this.ball.vx * normXBody + this.ball.vy * normYBody;

                // Only reflect if ball is moving towards the body
                if (dotProductBody < 0) {
                    const impulseMagnitudeBody = -(1 + C.BALL_BOUNCE) * dotProductBody;
                    this.ball.vx += impulseMagnitudeBody * normXBody;
                    this.ball.vy += impulseMagnitudeBody * normYBody;
                }
                // TODO: Add body hit sound
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
            // Add other cases later
        }
    }

    private update(dt: number): void {
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
                // Handle Input
                // Player 1
                let p1EffectiveSpeed = this.player1.playerSpeed * this.player1.speedMultiplier;
                if (this.inputHandler.isKeyPressed(C.Player1Controls.LEFT)) {
                    this.player1.vx = -p1EffectiveSpeed; // Use effective speed
                    this.player1.facingDirection = -1;
                } else if (this.inputHandler.isKeyPressed(C.Player1Controls.RIGHT)) {
                    this.player1.vx = p1EffectiveSpeed; // Use effective speed
                    this.player1.facingDirection = 1;
                } else {
                    this.player1.vx = 0;
                }
                if (this.inputHandler.isKeyPressed(C.Player1Controls.JUMP)) {
                    this.player1.jump(); // Jump uses multiplier internally
                }
                if (this.inputHandler.isKeyPressed(C.Player1Controls.KICK)) {
                    this.player1.startKick();
                }

                // Player 2
                let p2EffectiveSpeed = this.player2.playerSpeed * this.player2.speedMultiplier;
                if (this.inputHandler.isKeyPressed(C.Player2Controls.LEFT)) {
                    this.player2.vx = -p2EffectiveSpeed; // Use effective speed
                    this.player2.facingDirection = -1;
                } else if (this.inputHandler.isKeyPressed(C.Player2Controls.RIGHT)) {
                    this.player2.vx = p2EffectiveSpeed; // Use effective speed
                    this.player2.facingDirection = 1;
                } else {
                    this.player2.vx = 0;
                }
                if (this.inputHandler.isKeyPressed(C.Player2Controls.JUMP)) {
                    this.player2.jump(); // Jump uses multiplier internally
                }
                if (this.inputHandler.isKeyPressed(C.Player2Controls.KICK)) {
                    this.player2.startKick();
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
                    // console.log(`GameManager: Emitting landing dust for P1 (Vy: ${this.player1.lastLandingVy.toFixed(1)})`); // DEBUG LOG
                    this.particleSystem.emit('landingDust', this.player1.x, this.player1.y, 12, 
                        { scale: this.player1.sizeMultiplier, landingVelocity: this.player1.lastLandingVy });
                    this.player1.justLanded = false; // Reset flag immediately after use
                }
                this.player2.update(dt, C.GROUND_Y, C.SCREEN_WIDTH);
                 if (this.player2.justLanded) {
                     // console.log(`GameManager: Emitting landing dust for P2 (Vy: ${this.player2.lastLandingVy.toFixed(1)})`); // DEBUG LOG
                    this.particleSystem.emit('landingDust', this.player2.x, this.player2.y, 12, 
                        { scale: this.player2.sizeMultiplier, landingVelocity: this.player2.lastLandingVy });
                    this.player2.justLanded = false; // Reset flag immediately after use
                }

                // Update Ball (only if not frozen)
                if (!this.ball.isFrozen) {
                    this.ball.update(dt);
                } // else: Do nothing if frozen for now

                // Update Powerups
                this.powerupManager.update(dt);

                // Update Particle System
                this.particleSystem.update(dt); // Update particles

                // Handle Collisions
                this.handleCollisions();

                // Check for Goals 
                this.checkGoal();
                break;
            case C.GameState.GOAL_SCORED:
                this.goalMessageTimer -= dt;
                if (this.goalMessageTimer <= 0) {
                    this.resetPositions(); // Reset after delay
                    this.currentState = C.GameState.PLAYING; // Resume playing
                }
                break;
            case C.GameState.MATCH_OVER:
                this.matchOverTimer -= dt;
                if (this.matchOverTimer <= 0) {
                    // For now, just restart a new match
                    // TODO: Implement game win check and GAME_OVER state here
                    console.log("Match Over! Starting new match.");
                    this.startNewMatch();
                }
                break;

            // TODO: Add GAME_OVER and TROPHY states later
        }
    }

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

        // Draw Powerups
        this.powerupManager.draw(this.ctx);

        // Draw Particles
        this.particleSystem.draw(this.ctx); // Draw particles

        // Draw UI using UIManager
        console.log(`GameManager render: ball.isFrozen=${this.ball.isFrozen}, ball.freezeTimer=${this.ball['freezeTimer']?.toFixed(2)}`); // DEBUG LOG
        const uiState: UIGameState = {
            currentState: this.currentState,
            player1Score: this.player1Score,
            player2Score: this.player2Score,
            // Player 1 timers/state
            p1SpeedBoostTimer: this.player1['speedBoostTimer'], // Access private timer
            p1SuperJumpTimer: this.player1['superJumpTimer'], // Access private timer
            p1BigPlayerTimer: this.player1['bigPlayerTimer'], // Access private timer
            // Player 2 timers/state
            p2SpeedBoostTimer: this.player2['speedBoostTimer'], // Access private timer
            p2SuperJumpTimer: this.player2['superJumpTimer'], // Access private timer
            p2BigPlayerTimer: this.player2['bigPlayerTimer'], // Access private timer
            // Global state
            ballIsFrozen: this.ball.isFrozen,
            ballFreezeTimer: this.ball['freezeTimer'], // Access private timer
            // Timers for UI messages (already passed)
            goalMessageTimer: this.goalMessageTimer,
            matchOverTimer: this.matchOverTimer
            // Pass winner info if needed later
        };
        this.uiManager.draw(uiState);

        // Draw Goal Message if needed
        if (this.currentState === C.GameState.GOAL_SCORED) {
            this.ctx.fillStyle = C.YELLOW; // Example color
            this.ctx.font = '60px Impact';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("GOAL!", C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 3);
        }

        // Draw Match Over Message if needed
        if (this.currentState === C.GameState.MATCH_OVER) {
            this.ctx.fillStyle = C.WHITE;
            this.ctx.font = '50px Arial';
            this.ctx.textAlign = 'center';
            const winner = this.player1Score >= MATCH_POINT_LIMIT ? "Player 1" : "Player 2";
            this.ctx.fillText(`${winner} Wins Match!`, C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 2 - 30);
            this.ctx.font = '30px Arial';
            this.ctx.fillText(`Score: ${this.player1Score} - ${this.player2Score}`, C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 2 + 20);
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
        this.ctx.fillStyle = C.GOAL_COLOR;
        this.ctx.strokeStyle = C.BLACK;
        this.ctx.lineWidth = 2;

        // Simple rectangle goals for now
        const goalWidth = 10; // Visual width of the goal post line

        // Left Goal
        this.ctx.fillRect(C.GOAL_LINE_X_LEFT - goalWidth, C.GOAL_Y_POS, goalWidth, C.GOAL_HEIGHT);
        this.ctx.strokeRect(C.GOAL_LINE_X_LEFT - goalWidth, C.GOAL_Y_POS, goalWidth, C.GOAL_HEIGHT);

        // Right Goal
        this.ctx.fillRect(C.GOAL_LINE_X_RIGHT, C.GOAL_Y_POS, goalWidth, C.GOAL_HEIGHT);
        this.ctx.strokeRect(C.GOAL_LINE_X_RIGHT, C.GOAL_Y_POS, goalWidth, C.GOAL_HEIGHT);
        // TODO: Add crossbars and nets later
    }
} 