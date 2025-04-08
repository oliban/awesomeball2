// Based on SimpleStickMan from reference/awesome-ball/simple_player.py

// Basic type for representing points or vectors
type Point = {
    x: number;
    y: number;
};

// Declare an external function type for playing sounds
// This will be passed in from the main game
type PlaySoundFunction = (soundUrlArray: string[]) => void;
let globalPlaySound: PlaySoundFunction | null = null;

// Set the global sound function (called from main.ts)
export function setPlayerSoundFunction(playSoundFn: PlaySoundFunction) {
    globalPlaySound = playSoundFn;
}

// Helper function to play sound if available
function playSound(soundUrlArray: string[]) {
    if (globalPlaySound) {
        globalPlaySound(soundUrlArray);
    }
}

// Helper function to calculate endpoint based on standard math angle (0=right, positive=CCW)
// Adjusted for canvas where Y increases downwards.
function calculateEndPoint(start: Point, length: number, angle: number): Point {
    return {
        x: start.x + length * Math.cos(angle),
        y: start.y - length * Math.sin(angle) // Subtract sin because canvas Y is inverted
    };
}

// --- Animation Constants (from reference) ---
const WALK_CYCLE_SPEED = 0.25 * 60; // Adjusted for dt (cycles per second)
const LEG_THIGH_SWING = Math.PI / 7.0;
const RUN_UPPER_ARM_SWING = Math.PI / 6.0;
const STAND_ANGLE = -Math.PI / 2; // Straight down

// Kick Animation Constants (Relative Pendulum)
const KICK_THIGH_WINDUP_REL = Math.PI / 2.5; // Angle *back* from vertical (e.g., 72 deg)
const KICK_THIGH_FOLLOW_REL = Math.PI / 1.5; // Keep angle *forward* MORE from vertical (e.g., 120 deg -> above horizontal)
const KICK_SHIN_WINDUP_ANGLE = Math.PI * 0.6; // Bend shin back relative to thigh
const KICK_SHIN_IMPACT_ANGLE = -Math.PI * 0.15; // Extend shin more at impact
const KICK_DURATION_SECONDS = 0.45; // Faster duration again (was 0.9)

// Animation speed for returning limbs to neutral
const RETURN_SPEED = 25.0; // Increased from 15.0 for faster snapping

// Helper for linear interpolation
function lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
}

// Simple easing functions
function easeInQuad(t: number): number { return t * t; }
function easeOutQuad(t: number): number { return t * (2 - t); }

export class Player {
    // Position and Velocity
    x: number;
    y: number;
    vx: number;
    vy: number;
    baseY: number; // Ground level or initial Y

    // State
    isJumping: boolean;
    isKicking: boolean;
    kickTimer: number;
    kickDuration: number = KICK_DURATION_SECONDS; 
    walkCycleTimer: number;
    facingDirection: 1 | -1; // 1 for right, -1 for left
    onOtherPlayerHead: boolean = false;
    onLeftCrossbar: boolean;
    onRightCrossbar: boolean;
    isStunned: boolean;
    stunTimer: number;
    isTumbling: boolean;
    tumbleTimer: number;
    rotationAngle: number; // For tumbling animation
    rotationVelocity: number; // For tumbling animation

    // Properties for tracking kick impact
    minKickDistSq: number = Infinity;
    kickImpactForceX: number = 0;
    kickImpactForceY: number = 0;

    // Appearance & Identification
    teamColor: string; // e.g., '#FFFFFF' or 'rgb(255, 255, 255)'
    teamAccent: string;
    eyeColor: string;
    // Consider adding a unique ID if needed later for multiple players
    // id: number;

    // Base Size Attributes (adjust values based on reference)
    readonly baseHeadRadius: number = 12;
    readonly baseTorsoLength: number = 36;
    readonly baseLimbWidth: number = 10;
    readonly baseArmLength: number = 24;
    readonly baseLegLength: number = 32;

    // Current Size Attributes (affected by powerups)
    headRadius: number;
    torsoLength: number;
    limbWidth: number;
    armLength: number;
    legLength: number;

    // Animation Angles (radians)
    leftThighAngle: number = STAND_ANGLE;
    rightThighAngle: number = STAND_ANGLE;
    leftShinAngle: number = 0;
    rightShinAngle: number = 0;
    leftArmAngle: number = STAND_ANGLE;
    rightArmAngle: number = STAND_ANGLE;
    // Maybe separate upper/lower arm/leg angles later if needed for more complex animation

    // Joint Positions (calculated during update/draw)
    // These might not need to be stored directly if calculated on the fly
    // headPos: Point = { x: 0, y: 0 };
    // neckPos: Point = { x: 0, y: 0 };
    // hipPos: Point = { x: 0, y: 0 };
    // ... and so on for knees, hands, feet

    // Powerups (using a Map for flexibility)
    activePowerups: Map<string, number> = new Map(); // Key: PowerupType, Value: Duration/Magnitude/Ammo
    isFlying: boolean = false;
    isBig: boolean = false;
    isShrunk: boolean = false;
    isEnormousHead: boolean = false;
    isControlsReversed: boolean = false;
    isSword: boolean = false;
    swordAngle: number = 0;

    // Physics Parameters (can be modified by powerups)
    jumpPower: number; // Set based on BASE_JUMP_POWER
    playerSpeed: number; // Set based on BASE_PLAYER_SPEED
    gravity: number; // Store the gravity value affecting this player

    constructor(
        x: number,
        y: number,
        facing: 1 | -1 = 1,
        teamColor: string = '#FFFFFF',
        teamAccent: string = '#000000',
        eyeColor: string = '#000000',
        gravity: number, // Pass gravity in
        jumpPower: number, // Pass base jump power
        playerSpeed: number // Pass base speed
    ) {
        this.x = x;
        this.y = y;
        this.baseY = y; // Store initial Y
        this.vx = 0;
        this.vy = 0;

        this.isJumping = false;
        this.isKicking = false;
        this.kickTimer = 0;
        this.walkCycleTimer = 0;
        this.facingDirection = facing;
        this.onLeftCrossbar = false;
        this.onRightCrossbar = false;
        this.isStunned = false;
        this.stunTimer = 0;
        this.isTumbling = false;
        this.tumbleTimer = 0;
        this.rotationAngle = 0;
        this.rotationVelocity = 0;

        this.teamColor = teamColor;
        this.teamAccent = teamAccent;
        this.eyeColor = eyeColor;

        // Initialize current size to base size
        this.headRadius = this.baseHeadRadius;
        this.torsoLength = this.baseTorsoLength;
        this.limbWidth = this.baseLimbWidth;
        this.armLength = this.baseArmLength;
        this.legLength = this.baseLegLength;

        // Store base physics values
        this.gravity = gravity;
        this.jumpPower = jumpPower;
        this.playerSpeed = playerSpeed;

        this.kickDuration = KICK_DURATION_SECONDS; // Ensure constant is used
    }

    // --- Methods will be added below ---
    
    /**
     * Draws the player stick figure on the canvas.
     * Assumes this.y is the feet position.
     */
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); // Save context state

        // --- Define Base Joint Positions --- 
        const hipPos: Point = { x: this.x, y: this.y - this.legLength }; // Top of legs
        const neckPos: Point = { x: hipPos.x, y: hipPos.y - this.torsoLength };
        const headCenter: Point = { x: neckPos.x, y: neckPos.y - this.headRadius };
        // Shoulders slightly offset from neck
        const shoulderOffsetY = this.headRadius * 0.2;
        const shoulderOffsetX = this.limbWidth * 0.5; 
        const leftShoulderPos: Point = { x: neckPos.x - shoulderOffsetX, y: neckPos.y + shoulderOffsetY };
        const rightShoulderPos: Point = { x: neckPos.x + shoulderOffsetX, y: neckPos.y + shoulderOffsetY };

        // --- Calculate Limb Intermediate and Endpoints --- 
        // Arms (assuming arm angles are absolute for now, and forearm follows upper arm)
        const upperArmLength = this.armLength * 0.5;
        const lowerArmLength = this.armLength * 0.5;
        const leftElbowPos = calculateEndPoint(leftShoulderPos, upperArmLength, this.leftArmAngle);
        const leftHandPos = calculateEndPoint(leftElbowPos, lowerArmLength, this.leftArmAngle); // TODO: Add relative forearm angle later
        const rightElbowPos = calculateEndPoint(rightShoulderPos, upperArmLength, this.rightArmAngle);
        const rightHandPos = calculateEndPoint(rightElbowPos, lowerArmLength, this.rightArmAngle); // TODO: Add relative forearm angle later

        // Legs (shin angle is relative to thigh angle)
        const thighLength = this.legLength * 0.5;
        const shinLength = this.legLength * 0.5;
        const leftKneePos = calculateEndPoint(hipPos, thighLength, this.leftThighAngle);
        const leftFootPos = calculateEndPoint(leftKneePos, shinLength, this.leftThighAngle + this.leftShinAngle);
        const rightKneePos = calculateEndPoint(hipPos, thighLength, this.rightThighAngle);
        const rightFootPos = calculateEndPoint(rightKneePos, shinLength, this.rightThighAngle + this.rightShinAngle);
        // We expect footPos.y to be roughly this.y, adjust calculation or base point if needed

        // --- Draw Components --- 
        ctx.lineWidth = this.limbWidth;
        ctx.lineCap = 'round';

        // 1. Torso (Hip to Neck)
        ctx.strokeStyle = this.teamColor;
        ctx.beginPath();
        ctx.moveTo(hipPos.x, hipPos.y);
        ctx.lineTo(neckPos.x, neckPos.y);
        ctx.stroke();

        // 2. Head
        ctx.fillStyle = this.teamColor;
        ctx.beginPath();
        ctx.arc(headCenter.x, headCenter.y, this.headRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 3. Eyes
        const eyeRadius = this.headRadius * 0.15;
        const eyeOffsetX = this.headRadius * 0.4 * this.facingDirection; // Offset based on direction
        const eyeOffsetY = -this.headRadius * 0.2;
        const leftEyePos: Point = { x: headCenter.x + eyeOffsetX - eyeRadius * 1.5 * this.facingDirection, y: headCenter.y + eyeOffsetY };
        const rightEyePos: Point = { x: headCenter.x + eyeOffsetX + eyeRadius * 1.5 * this.facingDirection, y: headCenter.y + eyeOffsetY };

        ctx.fillStyle = this.eyeColor;
        ctx.beginPath();
        ctx.arc(leftEyePos.x, leftEyePos.y, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rightEyePos.x, rightEyePos.y, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        // 4. Arms (Shoulder -> Elbow -> Hand)
        ctx.strokeStyle = this.teamAccent;
        ctx.beginPath();
        ctx.moveTo(leftShoulderPos.x, leftShoulderPos.y);
        ctx.lineTo(leftElbowPos.x, leftElbowPos.y);
        ctx.lineTo(leftHandPos.x, leftHandPos.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rightShoulderPos.x, rightShoulderPos.y);
        ctx.lineTo(rightElbowPos.x, rightElbowPos.y);
        ctx.lineTo(rightHandPos.x, rightHandPos.y);
        ctx.stroke();

        // 5. Legs (Hip -> Knee -> Foot)
        ctx.strokeStyle = this.teamColor;
        ctx.beginPath();
        ctx.moveTo(hipPos.x, hipPos.y);
        ctx.lineTo(leftKneePos.x, leftKneePos.y);
        ctx.lineTo(leftFootPos.x, leftFootPos.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hipPos.x, hipPos.y);
        ctx.lineTo(rightKneePos.x, rightKneePos.y);
        ctx.lineTo(rightFootPos.x, rightFootPos.y);
        ctx.stroke();

        ctx.restore(); // Restore context state
    }

    /**
     * Updates the player's physics state (velocity, position, ground collision, wall collision).
     * @param dt Delta time in seconds
     * @param groundY The Y coordinate of the ground
     * @param screenWidth The width of the game screen
     */
    update(dt: number, groundY: number, screenWidth: number) {
        // Reset the onOtherPlayerHead flag each frame (will be set by collision detection if needed)
        this.onOtherPlayerHead = false;
        
        // First, handle kick animation if currently kicking
        if (this.isKicking) {
            // Increment kick timer
            const prevKickTimer = this.kickTimer;
            this.kickTimer += dt;
            
            // Monitor progress through kick animation
            const kickProgress = this.kickTimer / this.kickDuration;
            // console.log(`Kick progress: ${kickProgress.toFixed(2)}`);
            
            // Reset kick timer if kick is done
            if (this.kickTimer >= this.kickDuration) {
                this.kickTimer = 0;
                this.isKicking = false;
                // console.log('Kick animation ended');
            }
            
            // Animate kick based on timeline with distinct phases
            const windupEnd = 0.2; // First 20% is windup
            const impactFrame = 0.4; // Impact around 40% through
            const followEnd = 1.0; // Follow through to the end
            
            // Threshold detection for tracking when the kick enters the impact frame
            const impactThreshold = 0.01; // Small window for accuracy, but avoid single-frame detections
            // Check if we just entered the impact frame
            const wasInImpact = (prevKickTimer / this.kickDuration) >= (impactFrame - impactThreshold) && 
                               (prevKickTimer / this.kickDuration) <= (impactFrame + impactThreshold);
            const isInImpact = kickProgress >= (impactFrame - impactThreshold) && 
                               kickProgress <= (impactFrame + impactThreshold);
            
            if (!wasInImpact && isInImpact) {
                // console.log('%cKICK IMPACT FRAME!', 'color: red; font-weight: bold;');
                // Impact event happened here!
            }
            
            // Windback phase: Player readies leg
            if (kickProgress < windupEnd) {
                // Scale how far back the leg goes, easing in
                const phaseProgress = easeInQuad(kickProgress / windupEnd);
                
                // Determine angle for the kicking leg
                if (this.facingDirection === 1) {
                    // Right Leg kicks when facing right
                    this.rightThighAngle = STAND_ANGLE + phaseProgress * -KICK_THIGH_WINDUP_REL;
                    this.rightShinAngle = KICK_SHIN_WINDUP_ANGLE;
                } else {
                    // Left Leg kicks when facing left
                    this.leftThighAngle = STAND_ANGLE + phaseProgress * KICK_THIGH_WINDUP_REL;
                    this.leftShinAngle = KICK_SHIN_WINDUP_ANGLE;
                }
            } 
            // Kick forward phase: Leg extends for kick
            else if (kickProgress < followEnd) {
                // Linear progress from windup to follow-through
                const phaseProgress = (kickProgress - windupEnd) / (followEnd - windupEnd);
                
                // Determine leg position during kick
                if (this.facingDirection === 1) {
                    // Right Leg kicks when facing right
                    // Angle transitions from windback (-WINDUP_REL) to extended (FOLLOW_REL)
                    // Negative windback, positive follow-through
                    this.rightThighAngle = STAND_ANGLE + 
                                          lerp(-KICK_THIGH_WINDUP_REL, KICK_THIGH_FOLLOW_REL, phaseProgress);
                    
                    // Shin starts bent, extends for impact, then maintains
                    if (phaseProgress < 0.5) {
                        // First half: transition from windup to impact
                        const shinPhase = phaseProgress / 0.5; // Normalize to 0-1 for shin
                        this.rightShinAngle = lerp(KICK_SHIN_WINDUP_ANGLE, KICK_SHIN_IMPACT_ANGLE, shinPhase);
                    } else {
                        // Second half: keep extended
                        this.rightShinAngle = KICK_SHIN_IMPACT_ANGLE;
                    }
                } else {
                    // Left Leg kicks when facing left (mirror the right kick)
                    // For left kick, positive windback, negative follow-through
                    this.leftThighAngle = STAND_ANGLE + 
                                         lerp(KICK_THIGH_WINDUP_REL, -KICK_THIGH_FOLLOW_REL, phaseProgress);
                    
                    // Mirror the shin angle logic
                    if (phaseProgress < 0.5) {
                        const shinPhase = phaseProgress / 0.5;
                        this.leftShinAngle = lerp(KICK_SHIN_WINDUP_ANGLE, KICK_SHIN_IMPACT_ANGLE, shinPhase);
                    } else {
                        this.leftShinAngle = KICK_SHIN_IMPACT_ANGLE;
                    }
                }
            }
        } 
        else {
            // Not kicking - legs return to neutral 
            
            // Apply gravity if not on ground
            if (this.y < groundY && !this.onLeftCrossbar && !this.onRightCrossbar) {
                this.vy += this.gravity * dt;
                // Debug for gravity
                // console.log(`Applying gravity: vy=${this.vy}, dt=${dt}, gravity=${this.gravity}`);
            }
            
            // Check if player just landed
            const wasInAir = this.isJumping;
            
            // Position & velocity updates
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            
            // Debug for position update
            // console.log(`Position updated: y=${this.y}, vy=${this.vy}`);
            
            // Handle ground collision
            const hitGround = this.y >= groundY;
            if (hitGround) {
                this.y = groundY; // Snap to ground
                if (wasInAir) {
                    // Just landed
                    this.isJumping = false;
                    this.vy = 0;
                    
                    // Play landing sound if falling fast enough
                    if (this.vy > 200) {
                        playSound(["sounds/land1.mp3", "sounds/land2.mp3"]);
                    }
                }
            }
            
            // Keep player within screen bounds
            if (this.x < 0) this.x = 0;
            if (this.x > screenWidth) this.x = screenWidth;
            
            // Handle crossbar hanging physics (if applicable)
            
            // If player can stand on the crossbar, implement that here
            // if (this.onCrossbar) { this.vy = 0; this.y = crossbarY; }
            
            // Non-jumping leg animation
            if (this.isJumping || this.onLeftCrossbar || this.onRightCrossbar) {
                // Jumping - both arms up, legs in "bent" position
                // ...legs code...
                
                // Calculate target angles for jumping pose
                const targetLeftThigh = STAND_ANGLE + Math.PI * 0.2;  // Thigh lifted slightly
                const targetRightThigh = STAND_ANGLE - Math.PI * 0.2; // Thigh lifted slightly
                const targetShin = -Math.PI * 0.2; // Shin angle relative to thigh (bent forward)
                
                // Smoothly animate toward target
                const legReturnSpeed = RETURN_SPEED * dt;
                this.leftThighAngle += (targetLeftThigh - this.leftThighAngle) * legReturnSpeed;
                this.rightThighAngle += (targetRightThigh - this.rightThighAngle) * legReturnSpeed;
                this.leftShinAngle += (targetShin - this.leftShinAngle) * legReturnSpeed; 
                this.rightShinAngle += (targetShin - this.rightShinAngle) * legReturnSpeed;
                
                // ... arms code ...
            } else if (hitGround && this.vx !== 0) {
                // Walking animation - Calculate target angles for walking
                this.walkCycleTimer += dt * WALK_CYCLE_SPEED;
                
                // Sine wave oscillation for leg swing
                const legSwing = Math.sin(this.walkCycleTimer * Math.PI * 2) * LEG_THIGH_SWING; 
                
                // Apply leg swinging
                this.leftThighAngle = STAND_ANGLE + legSwing; 
                this.rightThighAngle = STAND_ANGLE - legSwing; // Opposite of left
                
                // Apply natural shin angle based on leg swing
                this.leftShinAngle = legSwing * -0.5; // Less bend than thigh
                this.rightShinAngle = -legSwing * -0.5; 
                
                // Arm swings opposite of legs
                this.leftArmAngle = STAND_ANGLE - legSwing * (RUN_UPPER_ARM_SWING / LEG_THIGH_SWING);
                this.rightArmAngle = STAND_ANGLE + legSwing * (RUN_UPPER_ARM_SWING / LEG_THIGH_SWING);
                
            } else {
                // Standing - Return to neutral pose
                // Legs
                const standingReturn = RETURN_SPEED * dt;
                this.leftThighAngle += (STAND_ANGLE - this.leftThighAngle) * standingReturn;
                this.rightThighAngle += (STAND_ANGLE - this.rightThighAngle) * standingReturn;
                this.leftShinAngle += (0 - this.leftShinAngle) * standingReturn;
                this.rightShinAngle += (0 - this.rightShinAngle) * standingReturn;
                
                // Arms
                this.leftArmAngle += (STAND_ANGLE - this.leftArmAngle) * standingReturn;
                this.rightArmAngle += (STAND_ANGLE - this.rightArmAngle) * standingReturn;
            }
        }

        // Update Tumble State
        if (this.isTumbling) {
            this.tumbleTimer -= dt;
            // TODO: Apply rotation based on rotationVelocity for drawing
            // this.rotationAngle += this.rotationVelocity * dt;
            if (this.tumbleTimer <= 0) {
                this.isTumbling = false;
                this.tumbleTimer = 0;
                this.rotationAngle = 0;
                this.rotationVelocity = 0;
                // Reset angles to standing after tumble
                this.leftThighAngle = STAND_ANGLE;
                this.rightThighAngle = STAND_ANGLE;
                this.leftShinAngle = 0;
                this.rightShinAngle = 0;
                this.leftArmAngle = STAND_ANGLE;
                this.rightArmAngle = STAND_ANGLE;
            }
        }

        // TODO: Handle stun timer
        // TODO: Update powerup timers
    }

    /**
     * Initiates the kick action if the player is not already kicking.
     */
    startKick() {
        // Add checks for stunned/tumbling later
        if (!this.isKicking) {
            this.isKicking = true;
            this.kickTimer = 0; // Reset kick timer
            this.vx = 0; // Stop horizontal movement during kick (optional, like reference?)
            // Reset kick impact tracking
            this.minKickDistSq = Infinity;
            this.kickImpactForceX = 0;
            this.kickImpactForceY = 0;
            
            // Play kick sound
            if (globalPlaySound) {
                playSound(["sounds/kick_ball1.mp3", "sounds/kick_ball2.mp3", "sounds/kick_ball3.mp3"]);
            }
        }
    }

    /**
     * Makes the player jump if they are on the ground.
     */
    jump() {
        // Allow jump if on the ground OR on the other player's head
        if (!this.isJumping || this.onOtherPlayerHead) {
            // Applicera jumpPower (negativ för uppåt rörelse)
            this.vy = this.jumpPower;
            this.isJumping = true;
            this.onOtherPlayerHead = false; // No longer on head once jumped
            
            // Debug logging
            console.log(`Player jump: vy=${this.vy}, jumpPower=${this.jumpPower}`);
            
            // Play jump sound (only play if we actually jumped)
            if (globalPlaySound) {
                playSound(["sounds/jump1.mp3"]);
            }
            
            return true; // Jump was performed
        }
        
        return false; // Jump was not performed
    }

    // applyGravity(dt: number) { ... } // Incorporated into update
    // handleCollisions(...) { ... }
    // startKick() { ... }
    // applyPowerup(...) { ... }
    // calculateCurrentSizes() { ... }
    // updateAnimation(dt: number) { ... }
    // etc.

    // --- Collision Shape Getters ---
    getHeadCircle(): { x: number, y: number, radius: number } {
        const neckPos: Point = { x: this.x, y: this.y - this.legLength - this.torsoLength };
        const headCenter: Point = { x: neckPos.x, y: neckPos.y - this.headRadius };
        return { x: headCenter.x, y: headCenter.y, radius: this.headRadius };
    }

    getBodyRect(): { x: number, y: number, width: number, height: number } {
        // Approximate body rectangle from hips down to feet
        const hipY = this.y - this.legLength;
        const height = this.legLength + this.torsoLength; // Torso + Legs
        // Use limbWidth as a base for width, maybe slightly wider?
        const width = this.limbWidth * 2; // BACK to standard width
        return {
            x: this.x - width / 2, // Centered around player x
            y: hipY - this.torsoLength, // Top of torso (approx neck)
            width: width,
            height: height
        };
    }

    /**
     * Starts the tumble animation.
     */
    startTumble() {
        if (!this.isTumbling) { // Prevent re-triggering mid-tumble
            this.isTumbling = true;
            // TODO: Define tumble duration constant
            this.tumbleTimer = 2.0; // Example duration
            // TODO: Define tumble rotation speed constants
            const minRotSpeed = 3.0 * Math.PI; // Radians per second
            const maxRotSpeed = 5.0 * Math.PI;
            this.rotationVelocity = (Math.random() * (maxRotSpeed - minRotSpeed) + minRotSpeed) * (Math.random() < 0.5 ? 1 : -1);
            this.isKicking = false; // Cancel kick if tumbling
            this.kickTimer = 0;
            // TODO: Play tumble/stun sound?
        }
    }

    // Helper to get the absolute position of the foot (end of shin)
    getFootPosition(isRightLeg: boolean): { x: number, y: number } {
        const thighAngle = isRightLeg ? this.rightThighAngle : this.leftThighAngle;
        const shinAngle = isRightLeg ? this.rightShinAngle : this.leftShinAngle;
        const thighLength = this.legLength * 0.5;
        const shinLength = this.legLength * 0.5;
        const hipPos: Point = { 
            x: this.x, 
            y: this.y - this.legLength // Hip relative to feet Y
        };

        // Use the global calculateEndPoint, passing Point objects
        const knee = calculateEndPoint(hipPos, thighLength, thighAngle); 
        const foot = calculateEndPoint(knee, shinLength, thighAngle + shinAngle);

        return foot;
    }

    /**
     * Gets the approximate position of the kicking foot's tip during the impact phase.
     * Returns null if not currently kicking.
     */
    getKickImpactPoint(): Point | null {
        if (!this.isKicking) {
            return null;
        }

        // Calculate angles specifically for the intended impact moment (e.g., progress = 0.4)
        const impactProgress = 0.4; // Corresponds to impactFrame in update()
        const windupEnd = 0.2;
        const followEnd = 1.0;

        let impactThighSwing = 0;
        let impactShinAngle = KICK_SHIN_IMPACT_ANGLE; // At impactProgress=0.4, shin angle should be at its target

        // Calculate thigh swing at impactProgress
        if (impactProgress >= windupEnd) { 
            const phaseProgress = (impactProgress - windupEnd) / (followEnd - windupEnd);
            // Note: Need access to KICK_THIGH_WINDUP_REL and KICK_THIGH_FOLLOW_REL here
            // Assuming they are accessible or defined globally/passed in.
            impactThighSwing = lerp(-KICK_THIGH_WINDUP_REL, KICK_THIGH_FOLLOW_REL, phaseProgress);
        } else {
            // Simplified: If impact is somehow before windup end, assume 0 swing for impact point
            impactThighSwing = 0; 
        }
        
        const hipPos: Point = { x: this.x, y: this.y - this.legLength };
        const thighLength = this.legLength * 0.5;
        const shinLength = this.legLength * 0.5;

        let kneePos: Point;
        let footPos: Point;
        let finalThighAngle: number;
        let finalShinAngle = impactShinAngle;

        if (this.facingDirection === 1) { // Kicking Right
            finalThighAngle = STAND_ANGLE + impactThighSwing;
            finalShinAngle = -impactShinAngle; // Shin angle needs flipping for right kick
            kneePos = calculateEndPoint(hipPos, thighLength, finalThighAngle);
            footPos = calculateEndPoint(kneePos, shinLength, finalThighAngle + finalShinAngle);
        } else { // Kicking Left
            finalThighAngle = STAND_ANGLE - impactThighSwing; // Mirrored relative swing
            // finalShinAngle = impactShinAngle; // Already set
            kneePos = calculateEndPoint(hipPos, thighLength, finalThighAngle);
            footPos = calculateEndPoint(kneePos, shinLength, finalThighAngle + finalShinAngle);
        }
        
        return footPos; // Return the calculated impact foot position
    }
} 