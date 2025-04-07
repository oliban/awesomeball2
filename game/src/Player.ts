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
function easeInOutQuad(t: number): number { 
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; 
}

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
        let targetLeftThigh = STAND_ANGLE;
        let targetRightThigh = STAND_ANGLE;
        let targetLeftShin = 0;
        let targetRightShin = 0;
        let targetLeftArm = STAND_ANGLE;
        let targetRightArm = STAND_ANGLE;

        if (this.isKicking) {
            this.kickTimer += dt;
            const progress = Math.min(this.kickTimer / this.kickDuration, 1.0);
            
            const windupEnd = 0.2;
            const impactFrame = 0.4;
            const followEnd = 1.0;

            let relativeThighSwing = 0;
            let kickShinAngle = 0;

            // --- Calculate relative angles ---
            // Thigh swing
            if (progress < windupEnd) { 
                const phaseProgress = progress / windupEnd;
                relativeThighSwing = lerp(0, -KICK_THIGH_WINDUP_REL, easeOutQuad(phaseProgress));
            } else { 
                const phaseProgress = (progress - windupEnd) / (followEnd - windupEnd);
                relativeThighSwing = lerp(-KICK_THIGH_WINDUP_REL, KICK_THIGH_FOLLOW_REL, phaseProgress);
            }
            // Shin angle
            if (progress < windupEnd * 0.8) { 
                 const phaseProgress = progress / (windupEnd * 0.8);
                 kickShinAngle = lerp(0, KICK_SHIN_WINDUP_ANGLE, easeOutQuad(phaseProgress));
            } else if (progress < impactFrame) { 
                const phaseProgress = (progress - (windupEnd * 0.8)) / (impactFrame - (windupEnd * 0.8));
                kickShinAngle = lerp(KICK_SHIN_WINDUP_ANGLE, KICK_SHIN_IMPACT_ANGLE, easeInQuad(phaseProgress));
            } else { 
                const phaseProgress = (progress - impactFrame) / (followEnd - impactFrame);
                kickShinAngle = lerp(KICK_SHIN_IMPACT_ANGLE, 0, easeOutQuad(phaseProgress));
            }
            // Arm angles (base for right kick)
            const armProgress = Math.sin(progress * Math.PI); 
            const armSwingMagnitude = Math.PI / 5;
            const rightKick_RightArmTarget = STAND_ANGLE - (relativeThighSwing * 0.2) - (armSwingMagnitude * armProgress);
            const rightKick_LeftArmTarget = STAND_ANGLE - (relativeThighSwing * 0.2) + (armSwingMagnitude * armProgress);

            const nonKickingThighSwingFactor = 0.3; // Apply 30% of the kick swing in opposite direction

            // --- Apply angles to targets based on ACTUAL direction --- 
            if (this.facingDirection === 1) { // Kicking Right
                targetRightThigh = STAND_ANGLE + relativeThighSwing; 
                targetRightShin = -kickShinAngle;
                targetLeftThigh = STAND_ANGLE - (relativeThighSwing * nonKickingThighSwingFactor); // Counter swing
                targetLeftShin = 0;
                targetRightArm = rightKick_RightArmTarget;
                targetLeftArm = rightKick_LeftArmTarget;
            } else { // Kicking Left
                targetLeftThigh = STAND_ANGLE - relativeThighSwing; // Mirrored relative swing
                targetLeftShin = kickShinAngle; // Shin angle is relative
                targetRightThigh = STAND_ANGLE + (relativeThighSwing * nonKickingThighSwingFactor); // Counter swing
                targetRightShin = 0;
                // Swap arm angles
                targetLeftArm = rightKick_RightArmTarget; 
                targetRightArm = rightKick_LeftArmTarget;
            }

            // --- LOGGING FOR DEBUG ---
            console.log(`Dir: ${this.facingDirection}, Prog: ${progress.toFixed(2)}, Thigh L/R: ${targetLeftThigh.toFixed(2)}/${targetRightThigh.toFixed(2)}, Shin L/R: ${targetLeftShin.toFixed(2)}/${targetRightShin.toFixed(2)}`);
            // console.log(`Arm L/R: ${targetLeftArm.toFixed(2)}/${targetRightArm.toFixed(2)}`);

            if (this.kickTimer >= this.kickDuration) {
                this.isKicking = false;
                this.kickTimer = 0;
            }
        } else if (isOnGround && this.vx !== 0) {
            // Walking animation - Calculate target angles for walking
            this.walkCycleTimer += dt * WALK_CYCLE_SPEED;
            const walkSin = Math.sin(this.walkCycleTimer);
            targetLeftThigh = STAND_ANGLE - LEG_THIGH_SWING * walkSin * this.facingDirection;
            targetRightThigh = STAND_ANGLE + LEG_THIGH_SWING * walkSin * this.facingDirection;
            targetLeftShin = 0; 
            targetRightShin = 0; 
            targetLeftArm = STAND_ANGLE + RUN_UPPER_ARM_SWING * walkSin * this.facingDirection;
            targetRightArm = STAND_ANGLE - RUN_UPPER_ARM_SWING * walkSin * this.facingDirection;
        } else {
            // Standing or Jumping pose - Target angles are STAND_ANGLE / default shin
            this.walkCycleTimer = 0; 
            // Target angles are already set to STAND_ANGLE/0 initially
             // TODO: Implement specific jumping pose target angles
        }

        // --- Smoothly interpolate current angles towards target angles ---
        this.leftThighAngle = lerp(this.leftThighAngle, targetLeftThigh, dt * RETURN_SPEED);
        this.rightThighAngle = lerp(this.rightThighAngle, targetRightThigh, dt * RETURN_SPEED);
        this.leftShinAngle = lerp(this.leftShinAngle, targetLeftShin, dt * RETURN_SPEED);
        this.rightShinAngle = lerp(this.rightShinAngle, targetRightShin, dt * RETURN_SPEED);
        this.leftArmAngle = lerp(this.leftArmAngle, targetLeftArm, dt * RETURN_SPEED);
        this.rightArmAngle = lerp(this.rightArmAngle, targetRightArm, dt * RETURN_SPEED);

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
            // TODO: Play kick sound
        }
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
} 