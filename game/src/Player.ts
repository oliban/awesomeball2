// Based on SimpleStickMan from reference/awesome-ball/simple_player.py

import * as C from './Constants';
import { audioManager } from './AudioManager';
import { Rocket } from './Rocket';
import { ParticleSystem } from './ParticleSystem';

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
const KICK_DURATION_SECONDS = 0.45; // Revert to original faster duration (was 0.85)
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
function easeInOutQuad(t: number): number {
    if (t < 0.5) {
        return 2 * t * t;
    } else {
        return 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
}

// ADD a new interface for the return type of the helper
interface RelativeLimbPositions {
    drawLThighAngle: number;
    drawRThighAngle: number;
    drawLShinAngle: number;
    drawRShinAngle: number;
    drawLArmAngle: number;
    drawRArmAngle: number;
    relHipPos: Point;
    relNeckPos: Point;
    relHeadCenter: Point;
    relLeftShoulderPos: Point;
    relRightShoulderPos: Point;
    relLeftElbowPos: Point;
    relLeftHandPos: Point;
    relRightElbowPos: Point;
    relRightHandPos: Point;
    relLeftKneePos: Point;
    relLeftFootPos: Point;
    relRightKneePos: Point;
    relRightFootPos: Point;
    isDrawingItching: boolean;
    eyeStyle: 'normal' | 'frantic';
    mouthStyle: 'normal' | 'jagged';
}

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
    public isBicycleKicking: boolean = false; // NEW state for bicycle kick
    public bicycleKickTimer: number = 0; // Timer for bicycle kick animation/logic
    public kickTimer: number;
    public kickDuration: number = KICK_DURATION_SECONDS;
    public walkCycleTimer: number;
    public facingDirection: number = 1; // 1 for right, -1 for left
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
    public readonly baseHeadRadius: number = 8; // Reduced from 10
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
    public isSwingingSword: boolean = false;
    private swordSwingTimer: number = 0;

    // Itching state
    public isItching: boolean = false;
    private itchingTimer: number = 0; // How long the itch lasts
    private readonly itchDuration: number = 10.0; // Default itch duration (seconds)

    // Bow and Arrow State
    public isAiming: boolean = false;
    public aimAngle: number = 0; // Angle relative to horizontal (0 = right)
    public drawPower: number = 0; // Power buildup (0 to 1?)

    // Equipment State
    public hasBow: boolean = false;
    public arrowAmmo: number = 0; // <<< ADDED

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

    private readonly swordSwingDuration: number = 0.6; // INCREASED DURATION
    private readonly swordSwingAngleMax: number = Math.PI * 1.5; // INCREASED ARC (270 deg)
    private readonly swordLengthMultiplier: number = 3.0; // NEW: Bigger sword multiplier

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
        this.isBicycleKicking = false; // Initialize bicycle kick state
        this.bicycleKickTimer = 0;     // Initialize bicycle kick timer
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

        // Initialize new bow state
        this.isAiming = false;
        this.aimAngle = 0;
        this.drawPower = 0;
        this.hasBow = false; // Initialize hasBow

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

        // Initialize size-dependent attributes
        this.updateSizeAttributes();
    }

    // ADD the new private helper method BEFORE draw()
    private _getRelativeLimbPositions(): RelativeLimbPositions {
        // --- Define angles to use for drawing ---
        let drawLThighAngle = this.leftThighAngle;
        let drawRThighAngle = this.rightThighAngle;
        let drawLShinAngle = this.leftShinAngle;
        let drawRShinAngle = this.rightShinAngle;
        let drawLArmAngle = this.leftArmAngle;
        let drawRArmAngle = this.rightArmAngle;

        // Ensure all angles have valid values
        if (isNaN(drawLThighAngle)) drawLThighAngle = STAND_ANGLE;
        if (isNaN(drawRThighAngle)) drawRThighAngle = STAND_ANGLE;
        if (isNaN(drawLShinAngle)) drawLShinAngle = 0;
        if (isNaN(drawRShinAngle)) drawRShinAngle = 0;
        if (isNaN(drawLArmAngle)) drawLArmAngle = STAND_ANGLE;
        if (isNaN(drawRArmAngle)) drawRArmAngle = STAND_ANGLE;

        // --- Itching Animation Override (Visual Only) ---
        let isDrawingItching = this.isItching;
        let eyeStyle: 'normal' | 'frantic' = 'normal';
        let mouthStyle: 'normal' | 'jagged' = 'normal';

        if (isDrawingItching) {
            const danceSpeed = 4.0;
            const time = (Date.now() / 1000) * danceSpeed;
            const phase = (Math.sin(time * Math.PI) + 1) / 2;
            const blend = phase < 0.5
                ? 4 * phase * phase * phase
                : 1 - Math.pow(-2 * phase + 2, 3) / 2;

            const poseA = { leftThigh: Math.PI * 0.3, leftShin: Math.PI * 0.4, leftArm: Math.PI * 0.6, rightThigh: -Math.PI * 0.2, rightShin: -Math.PI * 0.1, rightArm: -Math.PI * 0.3 };
            const poseB = { leftThigh: -Math.PI * 0.1, leftShin: -Math.PI * 0.2, leftArm: -Math.PI * 0.4, rightThigh: Math.PI * 0.4, rightShin: Math.PI * 0.5, rightArm: Math.PI * 0.7 };

            drawLThighAngle = C.STAND_ANGLE + lerp(poseA.leftThigh, poseB.leftThigh, blend);
            drawLShinAngle = lerp(poseA.leftShin, poseB.leftShin, blend);
            drawLArmAngle = C.STAND_ANGLE + lerp(poseA.leftArm, poseB.leftArm, blend);
            drawRThighAngle = C.STAND_ANGLE + lerp(poseA.rightThigh, poseB.rightThigh, blend);
            drawRShinAngle = lerp(poseA.rightShin, poseB.rightShin, blend);
            drawRArmAngle = C.STAND_ANGLE + lerp(poseA.rightArm, poseB.rightArm, blend);

            eyeStyle = 'frantic';
            mouthStyle = 'jagged';
        }

        // --- Define Base Joint Positions RELATIVE to player feet ---
        const relHipPos: Point = { x: 0, y: -this.legLength };
        const relNeckPos: Point = { x: 0, y: relHipPos.y - this.torsoLength };
        const relHeadCenter: Point = { x: 0, y: relNeckPos.y - this.headRadius };
        const relShoulderOffsetY = this.headRadius * 0.2;
        const relShoulderOffsetX = this.limbWidth * 0.5;
        const relLeftShoulderPos: Point = { x: relNeckPos.x - relShoulderOffsetX, y: relNeckPos.y + relShoulderOffsetY };
        const relRightShoulderPos: Point = { x: relNeckPos.x + relShoulderOffsetX, y: relNeckPos.y + relShoulderOffsetY };

        // --- Calculate Limb Intermediate and Endpoints using DRAW angles (Relative to joints) ---
        const upperArmLength = this.armLength * 0.5;
        const lowerArmLength = this.armLength * 0.5;
        const relLeftElbowPos = calculateEndPoint(relLeftShoulderPos, upperArmLength, drawLArmAngle);
        const relLeftHandPos = calculateEndPoint(relLeftElbowPos, lowerArmLength, drawLArmAngle);
        const relRightElbowPos = calculateEndPoint(relRightShoulderPos, upperArmLength, drawRArmAngle);
        const relRightHandPos = calculateEndPoint(relRightElbowPos, lowerArmLength, drawRArmAngle);

        const thighLength = this.legLength * 0.5;
        const shinLength = this.legLength * 0.5;
        const relLeftKneePos = calculateEndPoint(relHipPos, thighLength, drawLThighAngle);
        const relLeftFootPos = calculateEndPoint(relLeftKneePos, shinLength, drawLThighAngle + drawLShinAngle);
        const relRightKneePos = calculateEndPoint(relHipPos, thighLength, drawRThighAngle);
        const relRightFootPos = calculateEndPoint(relRightKneePos, shinLength, drawRThighAngle + drawRShinAngle);

        return {
            drawLThighAngle, drawRThighAngle, drawLShinAngle, drawRShinAngle, drawLArmAngle, drawRArmAngle,
            relHipPos, relNeckPos, relHeadCenter, relLeftShoulderPos, relRightShoulderPos,
            relLeftElbowPos, relLeftHandPos, relRightElbowPos, relRightHandPos,
            relLeftKneePos, relLeftFootPos, relRightKneePos, relRightFootPos,
            isDrawingItching, eyeStyle, mouthStyle
        };
    }

    /**
     * Draws the player stick figure on the canvas.
     * Assumes this.y is the feet position.
     */
    public draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); // Save context state
        ctx.translate(this.x, this.y); // Move origin to player feet FIRST

        // --- Calculate Relative Limb Positions using Helper ---
        const limbs = this._getRelativeLimbPositions();

        // Apply rotation if tumbling (AFTER calculating relative positions, before drawing)
        if (this.isTumbling) {
            // Rotate around the player's approximate center (relative to feet origin)
            const rotationCenterY = -(this.legLength + this.torsoLength / 2); // Center Y relative to feet
            ctx.translate(0, rotationCenterY); // Move origin UP from feet to rotation center
            ctx.rotate(this.rotationAngle);
            ctx.translate(0, -rotationCenterY); // Move origin back DOWN to feet
        }
        // --- ADD ROTATION FOR BICYCLE KICK --- 
        else if (this.isBicycleKicking) {
            // Rotate around the same approximate center
            const rotationCenterY = -(this.legLength + this.torsoLength / 2); 
            ctx.translate(0, rotationCenterY); 
            ctx.rotate(this.rotationAngle); // Use the angle set in update()
            ctx.translate(0, -rotationCenterY); 
        }

        // --- Drawing (All coordinates are relative to player feet 0,0) ---
        ctx.lineWidth = this.limbWidth;
        ctx.lineCap = 'round';

        // 1. Torso (Hip to Neck) - Use relative coordinates
        ctx.strokeStyle = this.teamColor;
        ctx.beginPath();
        ctx.moveTo(limbs.relHipPos.x, limbs.relHipPos.y); // Use helper result
        ctx.lineTo(limbs.relNeckPos.x, limbs.relNeckPos.y); // Use helper result
        ctx.stroke();

        // 2. Draw Head (Circle) - Use relative coordinates
        ctx.fillStyle = this.teamColor;
        ctx.beginPath();
        ctx.arc(limbs.relHeadCenter.x, limbs.relHeadCenter.y, this.headRadius, 0, Math.PI * 2); // Use helper result
        ctx.fill();
        ctx.stroke(); // Outline head

        // 3. Eyes - Use relative coordinates
        const eyeRadius = this.headRadius * 0.18;
        const eyeOffset = this.headRadius * 0.4;
        // Use relHeadX/Y derived from relHeadCenter
        const relHeadX = limbs.relHeadCenter.x; // It's 0 if centered on torso
        const relHeadY = limbs.relHeadCenter.y;

        if (limbs.isDrawingItching) { // Use helper result
             ctx.fillStyle = this.eyeColor;
             ctx.beginPath();
             ctx.arc(relHeadX - eyeOffset * 0.9, relHeadY + (Math.random() - 0.5) * 3, eyeRadius * 1.2, 0, Math.PI * 2);
             ctx.fill();
             ctx.beginPath();
             ctx.arc(relHeadX + eyeOffset * 1.1, relHeadY + (Math.random() - 0.5) * 3, eyeRadius * 0.8, 0, Math.PI * 2);
             ctx.fill();
        } else {
            ctx.fillStyle = this.eyeColor;
            ctx.beginPath();
            ctx.arc(relHeadX - eyeOffset, relHeadY, eyeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(relHeadX + eyeOffset, relHeadY, eyeRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3.5 Mouth - Use relative coordinates
        if (limbs.mouthStyle === 'jagged') { // Use helper result
             ctx.strokeStyle = C.BLACK;
             ctx.lineWidth = 1;
             ctx.beginPath();
             const mouthY = relHeadY + eyeOffset * 0.8;
             ctx.moveTo(relHeadX - eyeOffset * 0.8, mouthY);
             for (let i = 0; i < 4; i++) {
                 ctx.lineTo(relHeadX - eyeOffset * 0.8 + (eyeOffset * 1.6 * (i + Math.random())) / 4, mouthY + (Math.random() - 0.5) * 8);
             }
             ctx.lineTo(relHeadX + eyeOffset * 0.8, mouthY);
             ctx.stroke();
             ctx.lineWidth = this.limbWidth;
        } else {
            // Optional: Draw a simple normal mouth if needed
        }

        // 4. Arms (Shoulder -> Elbow -> Hand) - Use relative coordinates
        ctx.strokeStyle = this.teamAccent;
        ctx.beginPath();
        ctx.moveTo(limbs.relLeftShoulderPos.x, limbs.relLeftShoulderPos.y); // Use helper result
        ctx.lineTo(limbs.relLeftElbowPos.x, limbs.relLeftElbowPos.y);     // Use helper result
        ctx.lineTo(limbs.relLeftHandPos.x, limbs.relLeftHandPos.y);       // Use helper result
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(limbs.relRightShoulderPos.x, limbs.relRightShoulderPos.y); // Use helper result
        ctx.lineTo(limbs.relRightElbowPos.x, limbs.relRightElbowPos.y);      // Use helper result
        ctx.lineTo(limbs.relRightHandPos.x, limbs.relRightHandPos.y);        // Use helper result
        ctx.stroke();

        // 5. Legs (Hip -> Knee -> Foot/Ankle) - Use relative coordinates
        ctx.strokeStyle = this.teamColor;
        ctx.beginPath();
        ctx.moveTo(limbs.relHipPos.x, limbs.relHipPos.y);           // Use helper result
        ctx.lineTo(limbs.relLeftKneePos.x, limbs.relLeftKneePos.y); // Use helper result
        ctx.lineTo(limbs.relLeftFootPos.x, limbs.relLeftFootPos.y); // Use helper result
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(limbs.relHipPos.x, limbs.relHipPos.y);            // Use helper result
        ctx.lineTo(limbs.relRightKneePos.x, limbs.relRightKneePos.y); // Use helper result
        ctx.lineTo(limbs.relRightFootPos.x, limbs.relRightFootPos.y); // Use helper result
        ctx.stroke();

        // 6. Shoes (Draw AFTER legs) - Use relative coordinates for translation
        ctx.fillStyle = this.teamAccent;
        const drawShoe = (footPos: Point, facingDir: number) => {
            const finalShoeAngle = (facingDir === 1) ? 0 : Math.PI;
            ctx.save();
            // Translate relative to player feet origin (0,0)
            ctx.translate(footPos.x, footPos.y); // Use relative footPos
            ctx.rotate(finalShoeAngle);
            ctx.fillRect(0, -SHOE_HEIGHT / 2, SHOE_LENGTH, SHOE_HEIGHT);
            ctx.restore();
        };
        drawShoe(limbs.relLeftFootPos, this.facingDirection); // Use helper result
        drawShoe(limbs.relRightFootPos, this.facingDirection); // Use helper result

        // 7. Draw Rocket Launcher if equipped - Use relative coordinates
        if (this.hasRocketLauncher) {
            ctx.save();
            const launcherWidth = this.armLength * 1.1;
            const launcherHeight = this.limbWidth * 0.8;
            const verticalOffset = -(this.legLength + this.torsoLength * 0.3); 
            const horizontalOffset = this.facingDirection * (this.limbWidth * 0.5);
            ctx.translate(horizontalOffset, verticalOffset); // Translate relative to feet
            const drawOriginX = this.facingDirection === 1 ? 0 : -launcherWidth;
            ctx.fillStyle = '#808080'; 
            ctx.fillRect(drawOriginX, -launcherHeight / 2, launcherWidth, launcherHeight);
            ctx.strokeStyle = C.BLACK;
            ctx.lineWidth = 1;
            ctx.strokeRect(drawOriginX, -launcherHeight / 2, launcherWidth, launcherHeight);
            const nozzleX = this.facingDirection === 1 ? launcherWidth : -5;
            ctx.fillStyle = '#505050'; 
            ctx.fillRect(drawOriginX + nozzleX, -launcherHeight / 3, 5, launcherHeight * 0.66);
            ctx.restore();
        }

        // 8. Draw Bow if equipped
        if (this.hasBow) {
            ctx.save();
            const bowHorizontalOffset = this.facingDirection * (this.armLength * 0.6); 
            const bowVerticalOffset = -(this.legLength + this.torsoLength * 0.5); 
            ctx.translate(bowHorizontalOffset, bowVerticalOffset); // Translate to pivot point
            
            // Calculate effective angle for drawing (matches firing angle)
            const effectiveDrawAngle = this.facingDirection === 1 
                               ? this.aimAngle 
                               : Math.PI - this.aimAngle; // Mirror world angle if facing left
            
            ctx.rotate(effectiveDrawAngle); // Re-enable context rotation for proper bow orientation

            // --- Draw Bow Shape with context rotation --- 
            const bowLength = this.armLength * 2.2;
            const bowThickness = this.limbWidth * 0.6;
            const bowCurveDepth = bowLength * 0.2;
            const stringHandleOffset = -bowThickness * 0.8; // Offset string slightly towards player

            // Since we're now using context rotation, these calculations are simpler
            const halfLen = bowLength / 2;
            
            // String endpoints (with stringHandleOffset in the -x direction)
            const stringOffsetX = stringHandleOffset;
            const stringTopY = -halfLen; // Up in rotated context
            const stringBottomX = stringOffsetX;
            const stringBottomY = halfLen; // Down in rotated context

            // Curve control point (outwards along x-axis in rotated context)
            const curveControlX = stringOffsetX + bowCurveDepth;
            const curveControlY = 0; // Center point of the curve

            // --- Draw Bow String ---            
            ctx.strokeStyle = '#E0E0E0'; 
            ctx.lineWidth = 1.5; 
            ctx.lineCap = 'butt'; 
            ctx.beginPath();
            ctx.moveTo(stringOffsetX, stringTopY); // Use stringOffsetX for X
            ctx.lineTo(stringBottomX, stringBottomY);  
            ctx.stroke();

            // --- Draw Bow Curve --- 
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = bowThickness;
            ctx.lineCap = 'round'; 
            ctx.beginPath();
            ctx.moveTo(stringOffsetX, stringTopY); // Use stringOffsetX for X
            ctx.quadraticCurveTo(curveControlX, curveControlY, stringBottomX, stringBottomY); 
            ctx.stroke();

            // --- Debug Aiming Line (drawn along x-axis in rotated context) --- 
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 0); // Start at pivot
            ctx.lineTo(50, 0); // Draw line 50 units along the x-axis (aim direction)
            ctx.stroke();
            // --- End Debug Line ---

            ctx.restore();
        }

        // 9. Draw Sword (Attached to right hand)
        if (this.isSword) {
            ctx.save();
            ctx.translate(limbs.relRightHandPos.x, limbs.relRightHandPos.y);

            // Calculate sword angle (base depends on facing, modified by swing)
            const baseAngle = this.facingDirection === 1 ? Math.PI * 2/3 : Math.PI / 3 ; // NEW: Start more upwards
            const currentSwordVisualAngle = baseAngle + this.swordAngle;
            ctx.rotate(currentSwordVisualAngle);

            // Draw the sword relative to the hand (rotated context)
            const swordLength = this.armLength * this.swordLengthMultiplier;
            const hiltLength = swordLength * 0.15;
            const bladeLength = swordLength - hiltLength;
            const swordWidth = this.limbWidth * 0.8;

            // Hilt (brown rectangle)
            ctx.fillStyle = '#8B4513'; // Brown
            ctx.fillRect(0, -swordWidth / 2, hiltLength, swordWidth);

            // Blade (silver rectangle)
            ctx.fillStyle = '#C0C0C0'; // Silver
            ctx.fillRect(hiltLength, -swordWidth / 2 * 0.7, bladeLength, swordWidth * 0.7);

            // Outline
            ctx.strokeStyle = C.BLACK;
            ctx.lineWidth = 1;
            ctx.strokeRect(0, -swordWidth / 2, hiltLength, swordWidth);
            ctx.strokeRect(hiltLength, -swordWidth / 2 * 0.7, bladeLength, swordWidth * 0.7);

            ctx.restore();
        }

        ctx.restore(); // Restore context from initial translate
    }

    /**
     * Updates the player state.
     * @param dt Delta time
     * @param groundY Ground Y coordinate
     * @param screenWidth Screen width
     */
    public update(dt: number, groundY: number, screenWidth: number) {
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

        // --- Sword Swing Animation --- 
        if (this.isSwingingSword) {
            this.swordSwingTimer += dt;
            const swingProgress = Math.min(this.swordSwingTimer / this.swordSwingDuration, 1.0);
            
            // NEW animation: Linear sweep over the full angle range
            const startAngleOffset = 0; 
            const endAngleOffset = -this.swordSwingAngleMax * (this.facingDirection === 1 ? 1 : -1);
            this.swordAngle = lerp(startAngleOffset, endAngleOffset, swingProgress); 

            if (this.swordSwingTimer >= this.swordSwingDuration) {
                this.isSwingingSword = false;
                this.swordSwingTimer = 0;
            }
        } else {
            // Smoothly return swordAngle to 0 when not swinging
            const returnSpeedFactor = 0.15; // Adjust speed (smaller = slower return)
            this.swordAngle = lerp(this.swordAngle, 0, returnSpeedFactor); 
            // Optional: Snap to 0 if very close to avoid tiny lingering angles
            if (Math.abs(this.swordAngle) < 0.01) {
                this.swordAngle = 0;
            }
        }

        // Handle kicking OR regular movement/animations (only if NOT swinging sword)
        if (!this.isSwingingSword && this.isKicking) {
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
        // --- NEW: Handle Bicycle Kick State --- 
        else if (this.isBicycleKicking) {
            const bicycleKickTotalDuration = 1.0; // Keep the slower duration

            // --- Keyframes Definition (Refined based on reference image) --- 
            // Angles relative to STAND_ANGLE (-PI/2)
            // nk = Non-Kicking, k = Kicking
            const keyframes = [
                // KF0 (0%): Initial Slight Tuck / Lean Back
                { time: 0.0, angles: { nkThigh: STAND_ANGLE - 0.2 * Math.PI, nkShin: 0.3 * Math.PI, kThigh: STAND_ANGLE - 0.1 * Math.PI, kShin: 0.2 * Math.PI, lArm: STAND_ANGLE + 0.2 * Math.PI, rArm: STAND_ANGLE - 0.2 * Math.PI, rotationMag: 0 } },
                // KF1 (20%): Windup Peak / Start Rotation
                { time: 0.2, angles: { nkThigh: STAND_ANGLE - 0.7 * Math.PI, nkShin: 0.8 * Math.PI, kThigh: STAND_ANGLE + 0.3 * Math.PI, kShin: 0.6 * Math.PI, lArm: STAND_ANGLE + 0.6 * Math.PI, rArm: STAND_ANGLE - 0.7 * Math.PI, rotationMag: 0.4 * Math.PI } }, 
                // KF2 (50%): Impact / Inverted / Kicking Leg Extended
                { time: 0.5, angles: { nkThigh: STAND_ANGLE - 0.9 * Math.PI, nkShin: 0.8 * Math.PI, kThigh: STAND_ANGLE - 1.5 * Math.PI, kShin: 0.0 * Math.PI, lArm: STAND_ANGLE - 0.8 * Math.PI, rArm: STAND_ANGLE - 0.8 * Math.PI, rotationMag: 1.0 * Math.PI } }, 
                // KF3 (75%): Follow-through / Rotating Down / Kicking Leg Retracting
                { time: 0.75, angles: { nkThigh: STAND_ANGLE - 0.8 * Math.PI, nkShin: 0.9 * Math.PI, kThigh: STAND_ANGLE - 0.6 * Math.PI, kShin: 0.7 * Math.PI, lArm: STAND_ANGLE - 0.5 * Math.PI, rArm: STAND_ANGLE + 0.5 * Math.PI, rotationMag: 1.6 * Math.PI } },
                // KF4 (100%): End pose / Blending towards landing
                { time: 1.0, angles: { nkThigh: STAND_ANGLE - 0.4 * Math.PI, nkShin: 0.5 * Math.PI, kThigh: STAND_ANGLE - 0.4 * Math.PI, kShin: 0.5 * Math.PI, lArm: STAND_ANGLE, rArm: STAND_ANGLE, rotationMag: 2.0 * Math.PI } } 
            ];
            
            // Update the timer
            this.bicycleKickTimer += dt;
            const overallProgress = Math.min(this.bicycleKickTimer / bicycleKickTotalDuration, 1.0); 
            
            // --- Find keyframes to interpolate between ---
            let startKeyframe = keyframes[0];
            let endKeyframe = keyframes[1];
            
            for (let i = 0; i < keyframes.length - 1; i++) {
                if (overallProgress >= keyframes[i].time && overallProgress < keyframes[i + 1].time) {
                    startKeyframe = keyframes[i];
                    endKeyframe = keyframes[i + 1];
                    break;
                }
            }
            
            // Get the angles from current segment
            const startAngles = startKeyframe.angles;
            const endAngles = endKeyframe.angles;
            
            // Calculate progress within the current segment (0 to 1)
            const segmentDuration = endKeyframe.time - startKeyframe.time;
            const segmentProgress = segmentDuration > 0 
                ? (overallProgress - startKeyframe.time) / segmentDuration 
                : 1.0;
            
            // --- Interpolate all angles ---
            const interpolatedNkThigh = lerp(startAngles.nkThigh, endAngles.nkThigh, segmentProgress);
            const interpolatedKThigh = lerp(startAngles.kThigh, endAngles.kThigh, segmentProgress);
            const interpolatedNkShin = lerp(startAngles.nkShin, endAngles.nkShin, segmentProgress);
            const interpolatedKShin = lerp(startAngles.kShin, endAngles.kShin, segmentProgress);
            const interpolatedLArm = lerp(startAngles.lArm, endAngles.lArm, segmentProgress);
            const interpolatedRArm = lerp(startAngles.rArm, endAngles.rArm, segmentProgress);
            const interpolatedRotationMag = lerp(startAngles.rotationMag, endAngles.rotationMag, segmentProgress);

            // --- Apply Angles --- 
            const isRightLegKicking = this.facingDirection !== 1; // Right leg kicks if facing left

            if (isRightLegKicking) {
                this.rightThighAngle = interpolatedKThigh;
                this.rightShinAngle = interpolatedKShin;
                this.leftThighAngle = interpolatedNkThigh;
                this.leftShinAngle = interpolatedNkShin;
            } else { // Left leg is kicking
                this.leftThighAngle = interpolatedKThigh;
                this.leftShinAngle = interpolatedKShin;
                this.rightThighAngle = interpolatedNkThigh;
                this.rightShinAngle = interpolatedNkShin;
            }
            // Apply arm angles directly
            this.leftArmAngle = interpolatedLArm;
            this.rightArmAngle = interpolatedRArm;

            // Apply Rotation 
            // Match reference: If right leg kicks (facing left), rotate CW (+). If left leg kicks (facing right), rotate CCW (-).
            this.rotationAngle = isRightLegKicking ? interpolatedRotationMag : -interpolatedRotationMag;

            // --- End State --- 
            if (overallProgress >= 1.0) {
                this.isBicycleKicking = false;
                this.bicycleKickTimer = 0;
                this.rotationAngle = 0; // Reset rotation explicitly
                // Limb angles will blend back in the next frame via idle/walk/jump logic
            }
        }
        else if (!this.isSwingingSword) { // Regular movement/idle (only if not kicking AND not swinging)
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
                // Reset angles to standing after tumble
                this.leftThighAngle = STAND_ANGLE;
                this.rightThighAngle = STAND_ANGLE;
                this.leftShinAngle = 0;
                this.rightShinAngle = 0;
                this.leftArmAngle = STAND_ANGLE;
                this.rightArmAngle = STAND_ANGLE;
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

        // Itching Timer
        if (this.isItching) {
            this.itchingTimer -= dt;
            if (this.itchingTimer <= 0) {
                this.isItching = false;
                console.log(`Player ${this.teamColor} stopped itching`);
            }
        }

        // TODO: Handle stun timer
        // TODO: Update powerup timers
    }

    /**
     * Initiates the kick action if the player is not already kicking.
     */
    public startKick() {
        if (!this.isKicking && !this.isStunned && !this.isTumbling && !this.isItching) {
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
     * Initiates the bicycle kick action if the player is eligible.
     */
    public startBicycleKick() {
        const canStart = !this.isKicking && !this.isStunned && !this.isTumbling && !this.isItching && !this.isBicycleKicking;
        if (!canStart) {
            console.warn(`[Player.startBicycleKick] BLOCKED! States: isKicking=${this.isKicking}, isStunned=${this.isStunned}, isTumbling=${this.isTumbling}, isItching=${this.isItching}, isBicycleKicking=${this.isBicycleKicking}`);
        }
        
        if (canStart) {
            console.log(`[Player.startBicycleKick] Starting bicycle kick for player ${this.teamColor}`); // Added success log
            this.isBicycleKicking = true;
            this.bicycleKickTimer = 0;
            this.rotationAngle = 0;
            
            // --- Initialize to KF0 Angles (Refined) --- 
            const kf0Angles = { nkThigh: STAND_ANGLE - 0.2 * Math.PI, nkShin: 0.3 * Math.PI, kThigh: STAND_ANGLE - 0.1 * Math.PI, kShin: 0.2 * Math.PI, lArm: STAND_ANGLE + 0.2 * Math.PI, rArm: STAND_ANGLE - 0.2 * Math.PI }; // Angles from refined KF0
            const isRightLegKicking = this.facingDirection !== 1;

            if (isRightLegKicking) {
                this.rightThighAngle = kf0Angles.kThigh;
                this.rightShinAngle = kf0Angles.kShin;
                this.leftThighAngle = kf0Angles.nkThigh;
                this.leftShinAngle = kf0Angles.nkShin;
                this.rightArmAngle = kf0Angles.rArm; // Initialize arms
                this.leftArmAngle = kf0Angles.lArm;
            } else { // Left leg is kicking
                this.leftThighAngle = kf0Angles.kThigh;
                this.leftShinAngle = kf0Angles.kShin;
                this.rightThighAngle = kf0Angles.nkThigh;
                this.rightShinAngle = kf0Angles.nkShin;
                this.leftArmAngle = kf0Angles.lArm; // Initialize arms
                this.rightArmAngle = kf0Angles.rArm;
            }
            
            // Reset kick impact tracking
            this.minKickDistSq = Infinity;
            this.kickImpactForceX = 0;
            this.kickImpactForceY = 0;
            
            // Play bicycle kick sound if available
            audioManager.playSound('KICK_1'); // Using KICK_1 for now
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

    /**
     * Initiates the sword swing action if the player has a sword and is able.
     */
    public startSwordSwing() {
        if (this.isSword && !this.isSwingingSword && !this.isKicking && !this.isStunned && !this.isTumbling && !this.isItching) {
            this.isSwingingSword = true;
            this.swordSwingTimer = 0;
            this.swordAngle = 0; // Start angle
            // TODO: Play sword swing sound
            // audioManager.playSound('SWORD_SWOOSH'); 
            console.log("Player started sword swing!");
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
        if (!this.isTumbling && !this.isStunned) { // Prevent re-tumbling or tumbling while stunned
            this.isTumbling = true;
            this.tumbleTimer = C.ROCKET_TUMBLE_DURATION; // Use rocket duration for now
            // Give initial random rotation velocity
            this.rotationVelocity = (Math.random() - 0.5) * C.SWORD_TUMBLE_ROTATION_SPEED; // Use new constant
            this.rotationAngle = 0; // Start rotation from 0
            // Reset states
            this.isJumping = false;
            this.onOtherPlayerHead = false;
            this.onLeftCrossbar = false;
            this.onRightCrossbar = false;
            this.isKicking = false; // Cancel kick
            this.kickTimer = 0;
            // Don't reset velocity here, let the hit force do that
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
     * Get the impact point for a bicycle kick.
     * This is used for collision detection with the ball and other players.
     */
    getBicycleKickImpactPoint(): Point | null {
        if (!this.isBicycleKicking) return null;
        
        console.log(`[BicycleKick DETAIL] Progress: ${(this.bicycleKickTimer / 1.0).toFixed(2)}, Rotation: ${(this.rotationAngle * 180 / Math.PI).toFixed(1)}°`);
        
        // IMPROVED: Create a larger area for impact detection to ensure hits register
        // Calculate position based on the rotation
        const radius = this.legLength * 1.2; // Increased radius for better hit detection
        
        // Get rotation phase - useful for debugging
        let phase = "";
        const progress = this.bicycleKickTimer / 1.0;
        if (progress < 0.2) phase = "windup";
        else if (progress < 0.5) phase = "rising";
        else if (progress < 0.75) phase = "impact";
        else phase = "recovery";
        
        // Use the rotation angle to determine where the foot is
        // The impact point should trace an arc as the player rotates
        const angle = this.rotationAngle + (this.facingDirection > 0 ? Math.PI * 0.25 : -Math.PI * 0.25);
        
        // Calculate the kicking foot position
        const footX = this.x + Math.cos(angle) * radius; // REMOVED * this.facingDirection
        const footY = this.y - Math.sin(angle) * radius;
        
        console.log(`[BicycleKick] Impact Point: (${footX.toFixed(1)}, ${footY.toFixed(1)}), Angle: ${(angle * 180 / Math.PI).toFixed(1)}°, Phase: ${phase}, Facing: ${this.facingDirection}`);
        
        return { x: footX, y: footY };
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

    /**
     * Calculates the center position where the bow should be drawn.
     * Used for drawing the bow and spawning arrows.
     * NOTE: Returns position in world coordinates.
     */
    public getBowCenterPosition(): Point {
        const bowHorizontalOffset = this.facingDirection * (this.armLength * 0.6); // Corrected multiplier to 0.6
        const bowVerticalOffset = -this.legLength - this.torsoLength * 0.5; // Position near mid-torso Y relative to feet
        const bowCenterX = this.x + bowHorizontalOffset;
        const bowCenterY = this.y + bowVerticalOffset;
        return { x: bowCenterX, y: bowCenterY };
    }

    /**
     * Calculates the start and end points of the sword blade during a swing.
     * Returns null if the player doesn't have a sword or isn't swinging.
     * Positions are in world coordinates.
     */
    public getSwordCollisionShape(): { p1: Point, p2: Point } | null {
        if (!this.isSword || !this.isSwingingSword) {
            return null;
        }

        // --- Get Accurate Hand Position using Helper ---
        const limbs = this._getRelativeLimbPositions();
        const absRightHandPos: Point = {
            x: this.x + limbs.relRightHandPos.x,
            y: this.y + limbs.relRightHandPos.y
        };

        // Use the same dimensions and base angle as in draw/collision calculation
        const swordLength = this.armLength * this.swordLengthMultiplier;
        const hiltLength = swordLength * 0.15;
        const baseAngle = this.facingDirection === 1 ? Math.PI * 2/3 : Math.PI / 3 ; // NEW: Start more upwards (MATCH DRAW)
        const currentSwordWorldAngle = baseAngle + this.swordAngle;

        // Calculate sword start (near hilt/guard) and end (tip) in world space
        const swordStartOffset = hiltLength * 0.5; // Keep offset relative to new hilt length
        const p1 = calculateEndPoint(absRightHandPos, swordStartOffset, currentSwordWorldAngle);
        const p2 = calculateEndPoint(absRightHandPos, swordLength, currentSwordWorldAngle);

        return { p1, p2 };
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

    /**
     * Activates the itching state for a set duration.
     */
    public startItching(): void {
        if (!this.isItching) { // Don't reset if already itching
            console.log(`Player ${this.teamColor} started itching!`);
            this.isItching = true;
            this.itchingTimer = this.itchDuration;
            // Stop other actions potentially?
            this.isKicking = false;
            this.isTumbling = false; // Stop tumbling if hit while tumbling?
            this.isBeingPushedBack = false; // Stop pushback?
            // Keep movement? Maybe allow shuffling?
        }
    }

    updateAim(targetX: number, targetY: number) {
        const dx = targetX - this.x;
        const dy = targetY - this.y; 
        // Ensure this calculates WORLD angle directly (0=right, PI/2=up, -PI/2=down)
        // Always use -dy because Y is inverted in canvas vs math angle.
        this.aimAngle = Math.atan2(-dy, dx);
        // console.log(`DEBUG updateAim P${this.facingDirection === 1 ? 1 : 2}: aimAngle=${this.aimAngle.toFixed(2)}`); // Optional log
    }
} 