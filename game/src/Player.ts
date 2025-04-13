// Based on SimpleStickMan from reference/awesome-ball/simple_player.py

import * as C from './Constants';
import { audioManager } from './AudioManager'; // Import the AudioManager
import { Rocket } from './Rocket'; // Import Rocket class
import { ParticleSystem } from './ParticleSystem'; // Import ParticleSystem class

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
const WALK_CYCLE_SPEED = 0.0625 * 60; // Reduced by 50% AGAIN from 0.125*60
const LEG_THIGH_SWING = Math.PI / 7.0;
const RUN_UPPER_ARM_SWING = Math.PI / 6.0; // Keep the larger swing amplitude for now
const STAND_ANGLE = -Math.PI / 2; // Straight down

// Kick Animation Constants (Relative Pendulum)
const KICK_THIGH_WINDUP_REL = Math.PI / 2.5; // Angle *back* from vertical (e.g., 72 deg)
const KICK_THIGH_FOLLOW_REL = Math.PI / 1.5; // Keep angle *forward* MORE from vertical (e.g., 120 deg -> above horizontal)
const KICK_SHIN_WINDUP_ANGLE = Math.PI * 0.6; // Bend shin back relative to thigh
const KICK_SHIN_IMPACT_ANGLE = -Math.PI * 0.15; // Extend shin more at impact
const KICK_DURATION_SECONDS = 0.45; // Faster duration again (was 0.9)
const KICK_IMPACT_START = 0.15; // Widened impact phase start (was 0.25)
const KICK_IMPACT_END = 0.70;   // Widened impact phase end (was 0.50)

// NEW Shoe/Foot Constants
const SHOE_LENGTH = 14; // Increased size
const SHOE_HEIGHT = 8; // Increased size
const FOOT_HITBOX_RADIUS = 9; // Adjusted slightly for bigger shoe
const SHOE_STAND_ANGLE_OFFSET = Math.PI / 12; // Unused now, but keep for reference?

// Animation speed for returning limbs to neutral
const RETURN_SPEED = 25.0; // Increased from 15.0 for faster snapping

// Added Constants from main.ts for crossbar collision
const SCREEN_WIDTH = 800; // Assuming fixed width for now, ideally pass this in
const POST_THICKNESS = 8;
const GOAL_HEIGHT = 150;
const GOAL_WIDTH = 50;
const GROUND_Y = 600 - 50; // Assuming fixed height/ground for now
const GOAL_Y_POS = GROUND_Y - GOAL_HEIGHT;
const LEFT_GOAL_X = 0;
const RIGHT_GOAL_X = SCREEN_WIDTH - GOAL_WIDTH;

// Helper for linear interpolation
function lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
}

// Simple easing functions
function easeInQuad(t: number): number { return t * t; }
function easeOutQuad(t: number): number { return t * (2 - t); }

export class Player {
    // Position and Velocity
    public x: number;
    public y: number;
    public vx: number;
    public vy: number;
    public baseY: number; // Ground level or initial Y

    // State
    public isJumping: boolean;
    public hasJumpedThisPress: boolean = false; // Added flag for particle emission
    public isKicking: boolean;
    public kickTimer: number;
    public kickDuration: number = KICK_DURATION_SECONDS; 
    public walkCycleTimer: number;
    public facingDirection: number; // 1 for right, -1 for left
    public onOtherPlayerHead: boolean = false;
    public onLeftCrossbar: boolean;
    public onRightCrossbar: boolean;
    public justLanded: boolean = false; // Flag for landing dust effect
    public lastLandingVy: number = 0; // Store vertical velocity on landing
    public isStunned: boolean;
    public stunTimer: number;
    public isTumbling: boolean;
    public tumbleTimer: number;
    public rotationAngle: number; // For tumbling animation
    public rotationVelocity: number; // For tumbling animation

    // Properties for tracking kick impact
    public minKickDistSq: number = Infinity;
    public kickImpactForceX: number = 0;
    public kickImpactForceY: number = 0;

    // State flags for temporary effects
    public isBeingPushedBack: boolean = false;
    public pushbackTimer: number = 0;

    // Appearance & Identification
    public teamColor: string; // e.g., '#FFFFFF' or 'rgb(255, 255, 255)'
    public teamAccent: string;
    public eyeColor: string;
    // Consider adding a unique ID if needed later for multiple players
    // id: number;

    // Base Size Attributes (adjust values based on reference)
    public readonly baseHeadRadius: number = 12;
    public readonly baseTorsoLength: number = 36;
    public readonly baseLimbWidth: number = 10;
    public readonly baseArmLength: number = 24;
    public readonly baseLegLength: number = 32;

    // Current Size Attributes (affected by powerups)
    public headRadius: number;
    public torsoLength: number;
    public limbWidth: number;
    public armLength: number;
    public legLength: number;

    // Animation Angles (radians)
    public leftThighAngle: number = STAND_ANGLE;
    public rightThighAngle: number = STAND_ANGLE;
    public leftShinAngle: number = 0;
    public rightShinAngle: number = 0;
    public leftArmAngle: number = STAND_ANGLE;
    public rightArmAngle: number = STAND_ANGLE;
    // Maybe separate upper/lower arm/leg angles later if needed for more complex animation

    // Joint Positions (calculated during update/draw)
    // These might not need to be stored directly if calculated on the fly
    // headPos: Point = { x: 0, y: 0 };
    // neckPos: Point = { x: 0, y: 0 };
    // hipPos: Point = { x: 0, y: 0 };
    // ... and so on for knees, hands, feet

    // Powerups (using a Map for flexibility)
    public activePowerups: Map<string, number> = new Map(); // Key: PowerupType, Value: Duration/Magnitude/Ammo
    public isFlying: boolean = false;
    public isBig: boolean = false;
    public isShrunk: boolean = false;
    public isEnormousHead: boolean = false;
    public isControlsReversed: boolean = false;
    public isSword: boolean = false;
    public swordAngle: number = 0;

    // Itching Frenzy State
    public isItching: boolean = false;
    private itchingTimer: number = 0;
    private readonly ITCHING_DURATION: number = 10.0; // seconds (Match sound clip)

    // Physics Parameters (can be modified by powerups)
    public jumpPower: number; // Set based on BASE_JUMP_POWER
    public playerSpeed: number; // Set based on BASE_PLAYER_SPEED
    public gravity: number; // Store the gravity value affecting this player

    // --- Powerup State & Timers --- 
    public speedMultiplier: number = 1.0;
    public jumpMultiplier: number = 1.0;
    public sizeMultiplier: number = 1.0;
    private speedBoostTimer: number = 0;
    public superJumpTimer: number = 0;
    private bigPlayerTimer: number = 0;
    // Add timers for other effects later (shrink, enormous head, etc.)

    // Powerup States
    public hasRocketLauncher: boolean = false;
    public rocketAmmo: number = 0;

    constructor(
        x: number,
        y: number,
        facing: number,
        teamColor: string,
        teamAccent: string,
        eyeColor: string,
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
        this.hasJumpedThisPress = false; // Initialize in constructor
        this.justLanded = false; // Initialize flag
        this.lastLandingVy = 0; // Initialize velocity store
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
    public draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); // Save context state

        // Apply rotation if tumbling
        if (this.isTumbling) {
            ctx.translate(this.x, this.y - this.legLength / 2); // Rotate around torso center approx
            ctx.rotate(this.rotationAngle);
            ctx.translate(-this.x, -(this.y - this.legLength));
        }

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

        // Determine player state for drawing adjustments
        const isOnSurface = (this.y >= GROUND_Y || this.onLeftCrossbar || this.onRightCrossbar);
        const isStandingStill = isOnSurface && this.vx === 0;

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
        const eyeOffset = this.headRadius * 0.3;
        const eyeRadius = this.headRadius * 0.15;

        if (this.isItching) {
            // Frantic Eyes
            ctx.fillStyle = this.eyeColor;
            // Left Eye (maybe bigger, slightly off center)
            ctx.beginPath();
            ctx.arc(headCenter.x - eyeOffset * 0.9, headCenter.y + (Math.random() - 0.5) * 3, eyeRadius * 1.2, 0, Math.PI * 2);
            ctx.fill();
            // Right Eye (maybe smaller, slightly off center)
            ctx.beginPath();
            ctx.arc(headCenter.x + eyeOffset * 1.1, headCenter.y + (Math.random() - 0.5) * 3, eyeRadius * 0.8, 0, Math.PI * 2);
            ctx.fill();

             // Frantic Mouth (jagged line)
             ctx.strokeStyle = C.BLACK;
             ctx.lineWidth = 1;
             ctx.beginPath();
             ctx.moveTo(headCenter.x - eyeOffset * 0.8, headCenter.y + eyeOffset * 0.8);
             for (let i = 0; i < 4; i++) {
                 ctx.lineTo(headCenter.x - eyeOffset * 0.8 + (eyeOffset * 1.6 * (i + Math.random())) / 4, headCenter.y + eyeOffset * 0.8 + (Math.random() - 0.5) * 8);
             }
             ctx.lineTo(headCenter.x + eyeOffset * 0.8, headCenter.y + eyeOffset * 0.8);
             ctx.stroke();

        } else {
            // Normal Eyes
            ctx.fillStyle = this.eyeColor;
            // Left Eye
            ctx.beginPath();
            ctx.arc(headCenter.x - eyeOffset, headCenter.y, eyeRadius, 0, Math.PI * 2);
            ctx.fill();
            // Right Eye
            ctx.beginPath();
            ctx.arc(headCenter.x + eyeOffset, headCenter.y, eyeRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Set default line width for limbs BEFORE drawing arms/legs
        ctx.lineWidth = this.limbWidth;

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

        // 5. Legs (Hip -> Knee -> Foot/Ankle)
        ctx.strokeStyle = this.teamColor;
        // Left Leg
        ctx.beginPath();
        ctx.moveTo(hipPos.x, hipPos.y);
        ctx.lineTo(leftKneePos.x, leftKneePos.y);
        ctx.lineTo(leftFootPos.x, leftFootPos.y);
        ctx.stroke();
        // Right Leg
        ctx.beginPath();
        ctx.moveTo(hipPos.x, hipPos.y);
        ctx.lineTo(rightKneePos.x, rightKneePos.y);
        ctx.lineTo(rightFootPos.x, rightFootPos.y);
        ctx.stroke();

        // 6. Shoes (Draw AFTER legs)
        ctx.fillStyle = this.teamAccent; // Use accent color for shoes
        // Function to draw a rotated rectangle (shoe)
        const drawShoe = (footPos: Point, facingDir: number) => {
            // Shoe angle is always horizontal based on facing direction
            const finalShoeAngle = (facingDir === 1) ? 0 : Math.PI; // 0 for right, PI for left
            
            ctx.save();
            ctx.translate(footPos.x, footPos.y);
            ctx.rotate(finalShoeAngle); // Use horizontal angle
            // Draw rectangle centered vertically at the ankle, extending forward from the ankle point
            ctx.fillRect(0, -SHOE_HEIGHT / 2, SHOE_LENGTH, SHOE_HEIGHT);
            ctx.restore();
        };

        // Pass only foot position and facing direction to drawShoe
        drawShoe(leftFootPos, this.facingDirection);
        drawShoe(rightFootPos, this.facingDirection);

        // 7. Draw Rocket Launcher if equipped
        if (this.hasRocketLauncher) {
            ctx.save();
            // Position near the hip/lower torso, slightly offset
            const launcherWidth = this.armLength * 1.1; // Slightly longer than arm
            const launcherHeight = this.limbWidth * 0.8; // Slightly thinner than limbs
            const verticalOffset = -this.legLength - this.torsoLength * 0.3; // Position relative to feet Y
            const horizontalOffset = this.facingDirection * (this.limbWidth * 0.5);

            ctx.translate(this.x + horizontalOffset, this.y + verticalOffset);
            // Keep launcher horizontal (no rotation applied here relative to player)
            // If player tumbles, the ctx is already rotated, so the launcher rotates with the player.
            // The launcher itself is drawn horizontally along the translated context's x-axis.

            // Adjust drawing origin based on facing direction so nozzle points outwards
            const drawOriginX = this.facingDirection === 1 ? 0 : -launcherWidth;

            // Draw launcher body (grey)
            ctx.fillStyle = '#808080'; // Grey
            ctx.fillRect(drawOriginX, -launcherHeight / 2, launcherWidth, launcherHeight);
            ctx.strokeStyle = C.BLACK;
            ctx.lineWidth = 1;
            ctx.strokeRect(drawOriginX, -launcherHeight / 2, launcherWidth, launcherHeight);

            // Optional: Draw a small nozzle/tip
            // Position nozzle at the correct end based on facing direction
            const nozzleX = this.facingDirection === 1 ? launcherWidth : -5;
            ctx.fillStyle = '#505050'; // Darker grey
            ctx.fillRect(drawOriginX + nozzleX, -launcherHeight / 3, 5, launcherHeight * 0.66);

            ctx.restore();
        }

        ctx.restore(); // Restore context state (main restore from draw method start)
    }

    /**
     * Updates the player state.
     * @param dt Delta time
     * @param groundY Ground Y coordinate
     * @param screenWidth Screen width
     */
    public update(dt: number, groundY: number, screenWidth: number) { // Keep params for now, use constants if needed
        // Reset flags
        this.onOtherPlayerHead = false;
        this.onLeftCrossbar = false; // Reset crossbar flags
        this.onRightCrossbar = false;

        // Apply gravity ALWAYS (if in air)
        // Gravity is NOT applied if standing on a crossbar (checked later)
        if (this.y < groundY && !this.onLeftCrossbar && !this.onRightCrossbar) {
            this.vy += this.gravity * dt;
        }

        // Store if player was in air before position updates
        const wasInAir = this.isJumping;
        const verticalVelocityBeforeUpdate = this.vy;

        // Update VERTICAL position ALWAYS
        this.y += this.vy * dt;

        // Update HORIZONTAL position ALWAYS (using existing velocity)
        this.x += this.vx * dt;

        let landedOnCrossbar = false;
        const crossbarTopY = GOAL_Y_POS - POST_THICKNESS; // Y coord of the top surface of the crossbar

        // --- Check Crossbar Collision --- 
        // Only check if falling or stationary vertically (vy >= 0)
        if (this.vy >= 0) {
            // Left Crossbar
            const leftCrossbar = { x: LEFT_GOAL_X, y: crossbarTopY, width: GOAL_WIDTH };
            if (this.x >= leftCrossbar.x && this.x <= leftCrossbar.x + leftCrossbar.width && 
                this.y >= leftCrossbar.y && this.y <= leftCrossbar.y + 10) { // Check if feet are at or slightly below top
                this.y = leftCrossbar.y; // Snap feet to crossbar top
                this.vy = 0;
                this.isJumping = false;
                this.onLeftCrossbar = true;
                landedOnCrossbar = true;
                // Play landing sound only if falling significantly
                if (wasInAir && verticalVelocityBeforeUpdate > 100) {
                    audioManager.playSound('LAND_1'); // Simpler landing sound for bar
                }
            }

            // Right Crossbar (only if not already landed on left)
            if (!landedOnCrossbar) {
                const rightCrossbar = { x: RIGHT_GOAL_X, y: crossbarTopY, width: GOAL_WIDTH };
                if (this.x >= rightCrossbar.x && this.x <= rightCrossbar.x + rightCrossbar.width &&
                    this.y >= rightCrossbar.y && this.y <= rightCrossbar.y + 10) { 
                    this.y = rightCrossbar.y; // Snap feet to crossbar top
                    this.vy = 0;
                    this.isJumping = false;
                    this.onRightCrossbar = true;
                    landedOnCrossbar = true;
                    // Play landing sound
                     if (wasInAir && verticalVelocityBeforeUpdate > 100) {
                        audioManager.playSound('LAND_1');
                    }
                }
            }
        }

        // Handle kicking OR regular movement/animations
        if (this.isKicking) {
            // Define kick animation phases here as they are used within this block
            const windupEnd = 0.2; // First 20% is windup
            // const impactFrame = 0.4; // Impact around 40% through (Keep commented or define if needed later)
            const followEnd = 1.0; // Follow through to the end

            // Increment kick timer
            const prevKickTimer = this.kickTimer;
            this.kickTimer += dt;

            // Monitor progress through kick animation
            const kickProgress = this.kickTimer / this.kickDuration;

            // Animate kick based on timeline
            // ... (rest of the existing kick animation leg angle updates based on kickProgress) ...
            // Windback phase: Player readies leg
            if (kickProgress < windupEnd) {
                const phaseProgress = easeInQuad(kickProgress / windupEnd);
                if (this.facingDirection === 1) { // Right Kick
                    this.rightThighAngle = STAND_ANGLE + phaseProgress * -KICK_THIGH_WINDUP_REL;
                    // Negate shin angle for right kick
                    this.rightShinAngle = -KICK_SHIN_WINDUP_ANGLE; 
                } else { // Left Kick
                    this.leftThighAngle = STAND_ANGLE + phaseProgress * KICK_THIGH_WINDUP_REL; 
                    this.leftShinAngle = KICK_SHIN_WINDUP_ANGLE; // Keep original for left
                }
            } 
            // Kick forward phase: Leg extends for kick
            else if (kickProgress < followEnd) {
                const phaseProgress = (kickProgress - windupEnd) / (followEnd - windupEnd);
                if (this.facingDirection === 1) { // Right Kick
                    this.rightThighAngle = STAND_ANGLE + lerp(-KICK_THIGH_WINDUP_REL, KICK_THIGH_FOLLOW_REL, phaseProgress);
                    // Lerp between negated shin angles for right kick
                    if (phaseProgress < 0.5) {
                        const shinPhase = phaseProgress / 0.5;
                        this.rightShinAngle = lerp(-KICK_SHIN_WINDUP_ANGLE, -KICK_SHIN_IMPACT_ANGLE, shinPhase);
                    } else {
                        this.rightShinAngle = -KICK_SHIN_IMPACT_ANGLE;
                    }
                } else { // Left Kick
                    this.leftThighAngle = STAND_ANGLE + lerp(KICK_THIGH_WINDUP_REL, -KICK_THIGH_FOLLOW_REL, phaseProgress);
                    // Keep original shin angles for left kick
                    if (phaseProgress < 0.5) {
                        const shinPhase = phaseProgress / 0.5;
                        this.leftShinAngle = lerp(KICK_SHIN_WINDUP_ANGLE, KICK_SHIN_IMPACT_ANGLE, shinPhase);
                    } else {
                        this.leftShinAngle = KICK_SHIN_IMPACT_ANGLE;
                    }
                }
            }
            // Reset kick timer if kick is done
             if (this.kickTimer >= this.kickDuration) {
                 this.kickTimer = 0;
                 this.isKicking = false;
             }
        } 
        else {
            // Not kicking: Handle non-kicking animations
            const isOnSurface = (this.y >= groundY || this.onLeftCrossbar || this.onRightCrossbar);

            if (this.isJumping && !isOnSurface) { // Apply jumping animation only if jumping AND in the air
                // Jumping animation
                const targetLeftThigh = STAND_ANGLE + Math.PI * 0.2;
                const targetRightThigh = STAND_ANGLE - Math.PI * 0.2;
                const targetShin = -Math.PI * 0.2;

                const legReturnSpeed = RETURN_SPEED * dt;
                this.leftThighAngle += (targetLeftThigh - this.leftThighAngle) * legReturnSpeed;
                this.rightThighAngle += (targetRightThigh - this.rightThighAngle) * legReturnSpeed;
                this.leftShinAngle += (targetShin - this.leftShinAngle) * legReturnSpeed;
                this.rightShinAngle += (targetShin - this.rightShinAngle) * legReturnSpeed;
                // Add arm animation for jumping if desired

            } else if (isOnSurface && this.vx !== 0) { // Walking on ground OR crossbar
                // Walking animation
                this.walkCycleTimer += dt * WALK_CYCLE_SPEED;
                const legSwing = Math.sin(this.walkCycleTimer * Math.PI * 2) * LEG_THIGH_SWING;
                this.leftThighAngle = STAND_ANGLE + legSwing;
                this.rightThighAngle = STAND_ANGLE - legSwing;
                this.leftShinAngle = legSwing * -0.5;
                this.rightShinAngle = -legSwing * -0.5;
                // Arm swings
                this.leftArmAngle = STAND_ANGLE - legSwing * (RUN_UPPER_ARM_SWING / LEG_THIGH_SWING);
                this.rightArmAngle = STAND_ANGLE + legSwing * (RUN_UPPER_ARM_SWING / LEG_THIGH_SWING);

            } else { // Standing on ground OR crossbar (or potentially other idle states)
                // Standing - Return to neutral pose
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

        // Keep player within screen bounds horizontally ALWAYS (after position update)
        if (this.x < 0) this.x = 0;
        if (this.x > screenWidth) this.x = screenWidth; // Use passed-in screenWidth

        // Handle ground collision ONLY IF NOT landed on crossbar
        if (!landedOnCrossbar) {
            const hitGround = this.y >= groundY;
            if (hitGround) {
                const verticalVelocityBeforeGroundHit = this.vy; // Use velocity just before setting y
                this.y = groundY; // Snap to ground
                this.vy = 0;      // Stop vertical movement

                if (wasInAir) { // Check if player just landed from a jump/fall
                    this.lastLandingVy = verticalVelocityBeforeGroundHit; // Store landing velocity
                    this.isJumping = false;
                    this.hasJumpedThisPress = false; // Reset particle flag on land
                    this.justLanded = true; // Set landing flag
                    // Play landing sound if falling fast enough
                    if (verticalVelocityBeforeGroundHit > 200) {
                        audioManager.playSound('LAND_2');
                    }
                }
            } else { // Player is in the air
                this.justLanded = false; // Ensure flag is false if not on ground
            }
        }
        
        // Update Tumble State
        if (this.isTumbling) {
            this.tumbleTimer -= dt;
            this.rotationAngle += this.rotationVelocity * dt;
            if (this.tumbleTimer <= 0) {
                this.isTumbling = false;
                this.tumbleTimer = 0;
                this.rotationAngle = 0;
                this.rotationVelocity = 0;
                audioManager.stopSound('ITCHING'); // Stop itching sound if tumbling starts
                // Reset angles to standing after tumble
                this.leftThighAngle = STAND_ANGLE;
                this.rightThighAngle = STAND_ANGLE;
                this.leftShinAngle = 0;
                this.rightShinAngle = 0;
                this.leftArmAngle = STAND_ANGLE;
                this.rightArmAngle = STAND_ANGLE;
            }
        } else if (this.isStunned) {
            // Handle stun timer and logic (e.g., flickering)
            // Make sure itching doesn't interfere
            if (this.isItching) audioManager.stopSound('ITCHING'); // Stop sound if stunned during frenzy
            this.isItching = false;
        } else if (this.isItching) {
            // ITCHING FRENZY ANIMATION
            this.itchingTimer -= dt;
            if (this.itchingTimer <= 0) {
                this.isItching = false;
                audioManager.stopSound('ITCHING'); // Stop sound when timer runs out
                console.log("Itching Frenzy Ended!");
            } else {
                // --- New Itching Dance Animation --- 
                const danceSpeed = 4.0; // How many full cycles per second
                const time = (this.ITCHING_DURATION - this.itchingTimer) * danceSpeed;
                // const phase = (time % 1.0); // Progress through the current cycle (0 to 1)
                
                // Define two itchy poses (angles relative to STAND_ANGLE or 0 for shin)
                const poseA = {
                    leftThigh: Math.PI * 0.3, leftShin: Math.PI * 0.4, leftArm: Math.PI * 0.6, 
                    rightThigh: -Math.PI * 0.2, rightShin: -Math.PI * 0.1, rightArm: -Math.PI * 0.3
                };
                const poseB = {
                    leftThigh: -Math.PI * 0.1, leftShin: -Math.PI * 0.2, leftArm: -Math.PI * 0.4, 
                    rightThigh: Math.PI * 0.4, rightShin: Math.PI * 0.5, rightArm: Math.PI * 0.7
                };
                
                // Alternate between poses using a sine wave for smooth transition
                const blend = (Math.sin(time * Math.PI * 2) + 1) / 2; // 0 -> 1 -> 0 smoothly

                // Interpolate target angles based on blend factor
                const targetLThigh = STAND_ANGLE + lerp(poseA.leftThigh, poseB.leftThigh, blend);
                const targetLShin = lerp(poseA.leftShin, poseB.leftShin, blend);
                const targetLArm = STAND_ANGLE + lerp(poseA.leftArm, poseB.leftArm, blend);
                const targetRThigh = STAND_ANGLE + lerp(poseA.rightThigh, poseB.rightThigh, blend);
                const targetRShin = lerp(poseA.rightShin, poseB.rightShin, blend);
                const targetRArm = STAND_ANGLE + lerp(poseA.rightArm, poseB.rightArm, blend);

                // Move current angles towards target angles (gives a slightly laggy/floppy feel)
                const moveSpeed = dt * 15.0; // Speed of interpolation towards target
                this.leftThighAngle += (targetLThigh - this.leftThighAngle) * moveSpeed;
                this.leftShinAngle += (targetLShin - this.leftShinAngle) * moveSpeed;
                this.leftArmAngle += (targetLArm - this.leftArmAngle) * moveSpeed;
                this.rightThighAngle += (targetRThigh - this.rightThighAngle) * moveSpeed;
                this.rightShinAngle += (targetRShin - this.rightShinAngle) * moveSpeed;
                this.rightArmAngle += (targetRArm - this.rightArmAngle) * moveSpeed;
                // -------------------------------------
            }
            // SKIP NORMAL ANIMATION UPDATES BELOW
        } else {
            // --- NORMAL ANIMATION AND STATE UPDATES --- 
            // Apply gravity if player is not on the ground or on a crossbar
            if (this.y < groundY && !this.onLeftCrossbar && !this.onRightCrossbar) {
                this.vy += this.gravity * dt;
            }

            // Update VERTICAL position ALWAYS
            this.y += this.vy * dt;

            // Update HORIZONTAL position ALWAYS (using existing velocity)
            this.x += this.vx * dt;

            // Keep player within screen bounds horizontally ALWAYS (after position update)
            if (this.x < 0) this.x = 0;
            if (this.x > screenWidth) this.x = screenWidth; // Use passed-in screenWidth

            // Handle ground collision ONLY IF NOT landed on crossbar
            if (!landedOnCrossbar) {
                const hitGround = this.y >= groundY;
                if (hitGround) {
                    const verticalVelocityBeforeGroundHit = this.vy; // Use velocity just before setting y
                    this.y = groundY; // Snap to ground
                    this.vy = 0;      // Stop vertical movement

                    if (wasInAir) { // Check if player just landed from a jump/fall
                        this.lastLandingVy = verticalVelocityBeforeGroundHit; // Store landing velocity
                        this.isJumping = false;
                        this.hasJumpedThisPress = false; // Reset particle flag on land
                        this.justLanded = true; // Set landing flag
                        // Play landing sound if falling fast enough
                        if (verticalVelocityBeforeGroundHit > 200) {
                            audioManager.playSound('LAND_2');
                        }
                    }
                } else { // Player is in the air
                    this.justLanded = false; // Ensure flag is false if not on ground
                }
            }
        }

        // Update Pushback State
        if (this.isBeingPushedBack) {
            this.pushbackTimer -= dt;
            if (this.pushbackTimer <= 0) {
                this.isBeingPushedBack = false;
                this.pushbackTimer = 0;
                // Optionally reset vx here too, or let it decay naturally/be overridden by input
                // this.vx = 0; 
            }
        }

        // --- Update Powerup Timers & Effects --- 
        if (this.speedBoostTimer > 0) {
            this.speedBoostTimer -= dt;
            if (this.speedBoostTimer <= 0) {
                this.deactivateSpeedBoost();
            }
        }
        if (this.superJumpTimer > 0) {
            this.superJumpTimer -= dt;
            if (this.superJumpTimer <= 0) {
                this.deactivateSuperJump();
            }
        }
         if (this.bigPlayerTimer > 0) {
            this.bigPlayerTimer -= dt;
            if (this.bigPlayerTimer <= 0) {
                this.deactivateBigPlayer();
            }
        }
        // Update other timers later
    }

    /**
     * Initiates the kick action if the player is not already kicking.
     */
    public startKick() {
        if (!this.isKicking && !this.isStunned && !this.isTumbling) { 
            this.isKicking = true;
            this.kickTimer = 0;
            // Reset kick impact tracking for this kick
            this.minKickDistSq = Infinity;
            this.kickImpactForceX = 0;
            this.kickImpactForceY = 0;
            
            // --- Kick sound removed from here --- 
            // // Play kick sound
            // const kickSounds = ['KICK_1', 'KICK_2', 'KICK_3'];
            // const randomKickSound = kickSounds[Math.floor(Math.random() * kickSounds.length)];
            // audioManager.playSound(randomKickSound);
        }
    }

    /**
     * Makes the player jump if they are on the ground.
     */
    public jump() {
        let canJump = !this.isJumping && !this.isKicking && !this.isStunned && !this.isTumbling;
        // Allow jumping off opponent's head or crossbar
        if (this.onOtherPlayerHead || this.onLeftCrossbar || this.onRightCrossbar) {
            canJump = !this.isKicking && !this.isStunned && !this.isTumbling; // Can jump even if technically "jumping" (falling)
        }

        if (canJump) {
            const effectiveJumpPower = this.jumpPower * this.jumpMultiplier;
            this.vy = effectiveJumpPower; // Apply current jump power
            this.isJumping = true;
            this.hasJumpedThisPress = true; // For particle effect later
            this.onOtherPlayerHead = false; // Reset flags after jumping off
            this.onLeftCrossbar = false;
            this.onRightCrossbar = false;

            // Play jump sound
            audioManager.playSound('JUMP_1');
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
    public getHeadCircle(): { x: number, y: number, radius: number } {
        const neckPos: Point = { x: this.x, y: this.y - this.legLength - this.torsoLength };
        const headCenter: Point = { x: neckPos.x, y: neckPos.y - this.headRadius };
        return { x: headCenter.x, y: headCenter.y, radius: this.headRadius };
    }

    public getBodyRect(): { x: number, y: number, width: number, height: number } {
        const hipY = this.y - this.legLength;
        const height = this.legLength + this.torsoLength; 
        const width = this.limbWidth * 2; // Keep width based on limbWidth for now
        return {
            x: this.x - width / 2, 
            y: hipY - this.torsoLength, 
            width: width,
            height: height
        };
    }

    /**
     * Starts the tumble animation.
     */
    public startTumble() {
        if (!this.isTumbling) { // Prevent re-triggering mid-tumble
            this.isTumbling = true;
            this.tumbleTimer = C.ROCKET_TUMBLE_DURATION; // Use constant
            
            // Set rotation velocity
            const minRotSpeed = 3.0 * Math.PI; // Radians per second
            const maxRotSpeed = 5.0 * Math.PI;
            this.rotationVelocity = (Math.random() * (maxRotSpeed - minRotSpeed) + minRotSpeed) * (Math.random() < 0.5 ? 1 : -1);
            this.rotationAngle = 0; // Start rotation from 0
            
            this.isKicking = false; // Cancel kick if tumbling
            this.kickTimer = 0;
            // TODO: Play tumble/stun sound?
            console.log("Player started tumbling!");
        }
    }

    // Helper to get the absolute position of the foot (end of shin)
    public getFootPosition(isRightLeg: boolean): { x: number, y: number } {
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
    public getKickImpactPoint(): Point | null {
        if (!this.isKicking) {
            return null;
        }

        const kickProgress = this.kickTimer / this.kickDuration;

        // Check if the kick is within the impact phase
        if (kickProgress < KICK_IMPACT_START || kickProgress > KICK_IMPACT_END) {
            return null; // Not in impact phase
        }

        // Determine which leg is kicking based on facing direction
        const isRightLegKicking = this.facingDirection === 1;

        // Calculate the current foot position during the kick animation
        // This requires the animation logic to be accessible or duplicated here.
        // Simplified calculation for impact phase (assuming angles are set correctly by update)
        const hipPos: Point = { x: this.x, y: this.y - this.legLength };
        const thighAngle = isRightLegKicking ? this.rightThighAngle : this.leftThighAngle;
        const shinAngle = isRightLegKicking ? this.rightShinAngle : this.leftShinAngle;
        const thighLength = this.legLength * 0.5;
        const shinLength = this.legLength * 0.5;

        const kneePos = calculateEndPoint(hipPos, thighLength, thighAngle);
        const footPos = calculateEndPoint(kneePos, shinLength, thighAngle + shinAngle);

        return footPos;
    }

    /**
     * Calculates the position and radius of the foot hitboxes.
     * Returns an array containing two hitbox objects { x, y, radius }.
     */
    public getFootHitboxes(): { x: number, y: number, radius: number }[] {
        const hitboxes: { x: number, y: number, radius: number }[] = [];
        const hipPos: Point = { x: this.x, y: this.y - this.legLength };
        const thighLength = this.legLength * 0.5;
        const shinLength = this.legLength * 0.5;
        const footOffset = SHOE_LENGTH * 0.5; // Center hitbox slightly ahead of ankle

        // Left Foot
        const leftKneePos = calculateEndPoint(hipPos, thighLength, this.leftThighAngle);
        const leftAnklePos = calculateEndPoint(leftKneePos, shinLength, this.leftThighAngle + this.leftShinAngle);
        const leftShinAngle = this.leftThighAngle + this.leftShinAngle;
        const leftFootHitboxCenter = calculateEndPoint(leftAnklePos, footOffset, leftShinAngle);
        hitboxes.push({ x: leftFootHitboxCenter.x, y: leftFootHitboxCenter.y, radius: FOOT_HITBOX_RADIUS });

        // Right Foot
        const rightKneePos = calculateEndPoint(hipPos, thighLength, this.rightThighAngle);
        const rightAnklePos = calculateEndPoint(rightKneePos, shinLength, this.rightThighAngle + this.rightShinAngle);
        const rightShinAngle = this.rightThighAngle + this.rightShinAngle;
        const rightFootHitboxCenter = calculateEndPoint(rightAnklePos, footOffset, rightShinAngle);
        hitboxes.push({ x: rightFootHitboxCenter.x, y: rightFootHitboxCenter.y, radius: FOOT_HITBOX_RADIUS });

        return hitboxes;
    }

    // --- Powerup Activation/Deactivation Methods ---

    public activateSpeedBoost(): void {
        this.speedMultiplier = C.POWERUP_SPEED_BOOST_MULTIPLIER; 
        this.speedBoostTimer = C.POWERUP_SPEED_BOOST_DURATION;
        console.log("Speed Boost Activated!");
        // TODO: Add visual effect?
    }

    private deactivateSpeedBoost(): void {
        this.speedMultiplier = 1.0;
        console.log("Speed Boost Deactivated.");
    }

    public activateSuperJump(): void {
        this.jumpMultiplier = C.POWERUP_SUPER_JUMP_MULTIPLIER;
        this.superJumpTimer = C.POWERUP_SUPER_JUMP_DURATION;
        console.log("Super Jump Activated!");
    }

    private deactivateSuperJump(): void {
        this.jumpMultiplier = 1.0;
        console.log("Super Jump Deactivated.");
    }

    public activateBigPlayer(): void {
        this.sizeMultiplier = C.POWERUP_BIG_PLAYER_SCALE;
        this.bigPlayerTimer = C.POWERUP_BIG_PLAYER_DURATION;
        this.updateSizeAttributes(); // Apply size change immediately
        console.log("Big Player Activated!");
        // TODO: Handle conflict with shrink
    }

    private deactivateBigPlayer(): void {
        this.sizeMultiplier = 1.0;
        this.updateSizeAttributes(); // Revert size change
        console.log("Big Player Deactivated.");
    }

    public fireRocket(particleSystem: ParticleSystem): Rocket | null {
        // Check conditions BEFORE consuming ammo
        // console.log(`DEBUG: Attempting fireRocket. HasLauncher=${this.hasRocketLauncher}, Ammo=${this.rocketAmmo}, Stunned=${this.isStunned}, Tumbling=${this.isTumbling}`);
        if (!this.hasRocketLauncher || this.rocketAmmo <= 0 || this.isStunned || this.isTumbling) {
            return null; // Cannot fire
        }
        // console.log(` -> Checks passed!`);

        this.rocketAmmo--;
        console.log(`Player ${this.facingDirection === 1 ? 1 : 2} fired rocket! Ammo left: ${this.rocketAmmo}`);

        // --- Calculate Spawn Position from Launcher Nozzle --- 
        const launcherWidth = this.armLength * 1.1; 
        const launcherHeight = this.limbWidth * 0.8;
        const verticalOffset = -this.legLength - this.torsoLength * 0.3; // Same as draw logic
        const horizontalOffset = this.facingDirection * (this.limbWidth * 0.5); // Same as draw logic

        // Nozzle position relative to player's base coordinates (this.x, this.y)
        const nozzleTipOffset = this.facingDirection === 1 ? launcherWidth + 5 : -5; // Offset from launcher origin
        const launcherOriginX = this.x + horizontalOffset;
        const launcherOriginY = this.y + verticalOffset;

        // Spawn slightly beyond the nozzle tip in the facing direction
        const spawnX = launcherOriginX + (this.facingDirection * nozzleTipOffset) + (this.facingDirection * 5); // Add 5 units out
        const spawnY = launcherOriginY; // Y position is centered on the launcher height
        // -----------------------------------------------------

        // Calculate velocity
        const rocketVx = this.facingDirection * C.ROCKET_SPEED; // Use constant
        const rocketVy = 0; // Fires horizontally for now

        // Create the rocket instance
        const newRocket = new Rocket(spawnX, spawnY, rocketVx, rocketVy, this, particleSystem);

        // console.log(` -> Rocket Obj Created: Pos=(${newRocket.x.toFixed(0)},${newRocket.y.toFixed(0)}), Vel=(${newRocket.vx.toFixed(0)},${newRocket.vy.toFixed(0)})`);

        // Play fire sound
        audioManager.playSound('ROCKET_FIRE_1'); // Assume this sound exists

        if (this.rocketAmmo <= 0) {
            this.hasRocketLauncher = false; // Remove launcher when out of ammo
            console.log(`Player ${this.facingDirection === 1 ? 1 : 2} ran out of rockets.`);
        }

        return newRocket;
    }

    // Helper to apply size multiplier to dimensions
    private updateSizeAttributes(): void {
        this.headRadius = this.baseHeadRadius * this.sizeMultiplier;
        this.torsoLength = this.baseTorsoLength * this.sizeMultiplier;
        // Keep limb width constant for now, or scale differently?
        // this.limbWidth = this.baseLimbWidth * this.sizeMultiplier; 
        this.armLength = this.baseArmLength * this.sizeMultiplier;
        this.legLength = this.baseLegLength * this.sizeMultiplier;
        // Recalculate derived positions if needed, or let draw handle scaling
    }

    public startItchingFrenzy(): void {
        if (!this.isItching && !this.isStunned && !this.isTumbling) { // Don't trigger if already itching/stunned/tumbling
            this.isItching = true;
            this.itchingTimer = this.ITCHING_DURATION;
            console.log("Player started itching frenzy!");
            audioManager.playSound('ITCHING', 1, true); // Play sound (volume 1, loop true)
        }
    }
} 