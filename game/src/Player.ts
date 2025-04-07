// Based on SimpleStickMan from reference/awesome-ball/simple_player.py

// Basic type for representing points or vectors
type Point = {
    x: number;
    y: number;
};

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
    kickDuration: number; // Should match animation/logic time
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

    // Appearance & Identification
    teamColor: string; // e.g., '#FFFFFF' or 'rgb(255, 255, 255)'
    teamAccent: string;
    eyeColor: string;
    // Consider adding a unique ID if needed later for multiple players
    // id: number;

    // Base Size Attributes (adjust values based on reference)
    readonly baseHeadRadius: number = 12;
    readonly baseTorsoLength: number = 36;
    readonly baseLimbWidth: number = 6;
    readonly baseArmLength: number = 24;
    readonly baseLegLength: number = 28;

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
        this.kickDuration = 24 / 60; // Example: 24 frames at 60 FPS = 0.4 seconds
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

        // Remove angle setting from constructor, use property defaults
        // const standAngle = -Math.PI / 2;
        // this.leftThighAngle = standAngle;
        // this.rightThighAngle = standAngle;
        // this.leftShinAngle = 0; 
        // this.rightShinAngle = 0;
        // this.leftArmAngle = standAngle;
        // this.rightArmAngle = standAngle;
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
        // TODO: Draw eyes

        // 3. Arms (Shoulder -> Elbow -> Hand)
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

        // 4. Legs (Hip -> Knee -> Foot)
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
        // Reset head standing state each frame
        this.onOtherPlayerHead = false; 

        // Apply gravity
        this.vy += this.gravity * dt;

        // Update position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Ground collision
        let isOnGround = false;
        if (this.y >= groundY) {
            this.y = groundY;
            this.vy = 0;
            this.isJumping = false;
            isOnGround = true;
        }

        // Wall collisions
        const halfWidth = this.limbWidth / 2; // Simple approximation of half player width
        if (this.x - halfWidth <= 0) {
            this.x = halfWidth; // Snap to left boundary
            this.vx = 0;        // Stop horizontal movement
        } else if (this.x + halfWidth >= screenWidth) { // Need screenWidth passed in or accessed globally
            this.x = screenWidth - halfWidth; // Snap to right boundary
            this.vx = 0;         // Stop horizontal movement
        }

        // --- Update Animation --- 
        if (isOnGround && this.vx !== 0) {
            // Walking animation
            this.walkCycleTimer += dt * WALK_CYCLE_SPEED;
            const walkSin = Math.sin(this.walkCycleTimer);

            // Legs swing opposite to each other
            this.leftThighAngle = STAND_ANGLE - LEG_THIGH_SWING * walkSin * this.facingDirection;
            this.rightThighAngle = STAND_ANGLE + LEG_THIGH_SWING * walkSin * this.facingDirection;
            // TODO: Add shin bend based on walk cycle
            this.leftShinAngle = 0; // Keep straight for now
            this.rightShinAngle = 0; 

            // Arms swing opposite to legs and each other
            this.leftArmAngle = STAND_ANGLE + RUN_UPPER_ARM_SWING * walkSin * this.facingDirection;
            this.rightArmAngle = STAND_ANGLE - RUN_UPPER_ARM_SWING * walkSin * this.facingDirection;

        } else {
            // Standing or Jumping pose
            this.walkCycleTimer = 0; // Reset timer when not walking
            // TODO: Implement specific jumping pose angles
            this.leftThighAngle = STAND_ANGLE;
            this.rightThighAngle = STAND_ANGLE;
            this.leftShinAngle = 0;
            this.rightShinAngle = 0;
            this.leftArmAngle = STAND_ANGLE;
            this.rightArmAngle = STAND_ANGLE;
        }

        // TODO: Update kick animation timer
        // TODO: Update tumble animation timer/rotation
        // TODO: Handle stun timer
        // TODO: Update powerup timers
    }

    /**
     * Makes the player jump if they are on the ground.
     */
    jump() {
        // Allow jump if on the ground OR on the other player's head
        if (!this.isJumping || this.onOtherPlayerHead) {
            this.vy = this.jumpPower;
            this.isJumping = true;
            this.onOtherPlayerHead = false; // No longer on head once jumped
            // TODO: Play jump sound
        }
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
        const width = this.limbWidth * 2; 
        return {
            x: this.x - width / 2, // Centered around player x
            y: hipY - this.torsoLength, // Top of torso (approx neck)
            width: width,
            height: height
        };
    }
} 