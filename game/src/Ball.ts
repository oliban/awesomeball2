import * as C from './Constants';
import { audioManager } from './AudioManager'; // Import AudioManager

const BALL_RADIUS = 15;
const BALL_COLOR = '#FFFFFF';
const BALL_FRICTION = 0.99; // Slows down horizontal movement slightly each frame
const BALL_AIR_FRICTION = 0.995; // Slows down vertical movement slightly
const BALL_BOUNCE = 0.7; // Energy retained after bouncing off ground/walls

export class Ball {
    public x: number;
    public y: number;
    public vx: number;
    public vy: number;
    public radius: number;
    public color: string;
    public rotation: number = 0; // Add rotation property
    public rotationSpeed: number = 0; // Added rotationSpeed property
    public isFrozen: boolean = false; // Add isFrozen state
    private freezeTimer: number = 0; // Add freeze timer

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = C.BALL_RADIUS;
        this.color = C.WHITE; // Default color
    }

    update(dt: number): void {
        // Log velocity at the START of the update, AFTER collisions/forces may have been applied
        // console.log(`[Ball] Update START: vx=${this.vx.toFixed(1)}, vy=${this.vy.toFixed(1)}`);
        
        // Bail out early if frozen
        // console.log(`Ball update check: isFrozen=${this.isFrozen}, freezeTimer=${this.freezeTimer?.toFixed(2)}`); // DEBUG LOG
        if (this.isFrozen) {
            if (this.freezeTimer && this.freezeTimer > 0) {
                this.freezeTimer -= dt;
                if (this.freezeTimer <= 0) {
                    this.isFrozen = false;
                    console.log("Ball Unfrozen!");
                }
                return; // Skip all physics updates if frozen
            }
        }

        // Store velocity before physics for sound checks
        const vyBeforeUpdate = this.vy;
        const vxBeforeUpdate = this.vx;
        let soundPlayedThisFrame = false; // Prevent multiple sounds per frame

        // Apply gravity
        this.vy += C.GRAVITY * dt;

        // Apply simple friction
        const frictionFactor = C.BALL_FRICTION;
        this.vx *= frictionFactor;
        this.vy *= frictionFactor;

        // Update position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Update rotation
        this.rotation += (this.vx / this.radius) * dt;
        this.rotation += this.rotationSpeed * dt;

        // --- Environment Collisions --- 

        // Ground collision and bounce
        if (this.y + this.radius > C.GROUND_Y) {
            this.y = C.GROUND_Y - this.radius;
            // Only bounce and play sound if moving downwards significantly
            if (vyBeforeUpdate > 50) { // Threshold to prevent sound on rolling/resting
                this.vy *= -C.BALL_BOUNCE;
                this.vx *= 0.9; // Extra ground friction on bounce
                if (!soundPlayedThisFrame) {
                   audioManager.playSound('BALL_BOUNCE_1');
                   soundPlayedThisFrame = true;
                }
            } else {
                 this.vy = 0; // Stop vertical movement if resting/rolling
            }
            this.vx *= C.GROUND_FRICTION; // Apply normal ground friction anyway
        }

        // Wall collisions and bounce (excluding goal areas for simplicity for now)
        // TODO: Refine wall collision to not trigger inside goal mouths
        if (this.x - this.radius < 0 && (this.y <= C.GOAL_Y_POS || this.y >= C.GROUND_Y)) {
            this.x = this.radius;
             // Only bounce and play sound if moving left significantly
            if (vxBeforeUpdate < -50) { 
                this.vx *= -C.BALL_BOUNCE;
                if (!soundPlayedThisFrame) {
                    audioManager.playSound('WALL_HIT_1');
                    soundPlayedThisFrame = true;
                }
            } else {
                this.vx = 0;
            }
        } else if (this.x + this.radius > C.SCREEN_WIDTH && (this.y <= C.GOAL_Y_POS || this.y >= C.GROUND_Y)) {
            this.x = C.SCREEN_WIDTH - this.radius;
             // Only bounce and play sound if moving right significantly
            if (vxBeforeUpdate > 50) {
                this.vx *= -C.BALL_BOUNCE;
                 if (!soundPlayedThisFrame) {
                    audioManager.playSound('WALL_HIT_1');
                    soundPlayedThisFrame = true;
                 }
            } else {
                this.vx = 0;
            }
        }

        // --- Goal Post/Crossbar Collisions --- 
        // **Only check crossbars for now, based on reference logic**
        const crossbarRects = [
            // Left Goal Crossbar
            { x: C.LEFT_GOAL_X, y: C.GOAL_Y_POS - C.GOAL_POST_THICKNESS, width: C.GOAL_WIDTH, height: C.GOAL_POST_THICKNESS },
            // Right Goal Crossbar
            { x: C.RIGHT_GOAL_X, y: C.GOAL_Y_POS - C.GOAL_POST_THICKNESS, width: C.GOAL_WIDTH, height: C.GOAL_POST_THICKNESS },
        ];

        for (const bar of crossbarRects) {
             if (this.checkCircleRectCollision(this, bar)) {
                console.log("Crossbar Collision!");
                
                const POST_BOUNCE = 0.8; // Use reference bounce factor

                // Find closest point on bar to ball center
                const closestX = Math.max(bar.x, Math.min(this.x, bar.x + bar.width));
                const closestY = Math.max(bar.y, Math.min(this.y, bar.y + bar.height));
                const distX = this.x - closestX;
                const distY = this.y - closestY;
                const distance = Math.sqrt(distX * distX + distY * distY) || 1;
                const overlap = this.radius - distance;
                
                // Apply positional correction first
                if (overlap > 0) {
                    const correctionX = (distX / distance) * (overlap + 0.1);
                    const correctionY = (distY / distance) * (overlap + 0.1);
                    this.x += correctionX;
                    this.y += correctionY;
                }
                
                // --- Apply Reference Bounce Logic --- 
                if (Math.abs(distX) > Math.abs(distY)) { // More horizontal collision (Side hit)
                    this.vx = -this.vx * POST_BOUNCE; 
                    this.vy *= 0.95; // Damp vertical slightly
                } else { // More vertical collision
                    if (distY < 0) { // Hit TOP of crossbar
                        this.vy = -Math.abs(this.vy * POST_BOUNCE); // Bounce UP
                        if (this.vy > -80) this.vy -= 80; // Ensure minimum bounce speed
                    } else { // Hit BOTTOM of crossbar
                        this.vy = -Math.abs(this.vy * POST_BOUNCE); // Bounce UP
                        if (this.vy > -80) this.vy -= 80; // Ensure minimum bounce speed
                        // Nudge slightly horizontally (optional, from ref)
                        this.x += Math.sign(this.x - (bar.x + bar.width / 2)) * 1.0; 
                    }
                     this.vx *= 0.95; // Damp horizontal slightly on vertical hit
                }
                // --- End Reference Bounce Logic ---

                if (!soundPlayedThisFrame) {
                    audioManager.playSound('CROSSBAR_HIT');
                    soundPlayedThisFrame = true;
                }
                break; // Handle one crossbar collision per frame
            }
        }
    }

    // --- Helper function for goal post collision --- 
     private checkCircleRectCollision(circle: { x: number, y: number, radius: number }, rect: { x: number, y: number, width: number, height: number }): boolean {
        const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
        const distanceX = circle.x - closestX;
        const distanceY = circle.y - closestY;
        const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
        return distanceSquared < (circle.radius * circle.radius);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save(); // Save context state for rotation
        ctx.translate(this.x, this.y); // Move origin to ball center
        ctx.rotate(this.rotation); // Rotate context

        // 1. Draw Base White Circle (relative to new origin)
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = C.WHITE;
        ctx.fill();
        ctx.strokeStyle = C.BLACK; // Use black for outlines like seams
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.closePath();

        // 2. Draw Black Pentagons
        ctx.fillStyle = C.BLACK;
        const numPentagons = 6; // A typical soccer ball has pentagons and hexagons
        const angleStep = (Math.PI * 2) / numPentagons;
        const pentagonRadius = this.radius * 0.4; // Size of the pentagons
        const pentagonOffset = this.radius * 0.6; // Distance from center

        for (let i = 0; i < numPentagons; i++) {
            const centerAngle = i * angleStep;
            const pentagonCenterX = Math.cos(centerAngle) * pentagonOffset;
            const pentagonCenterY = Math.sin(centerAngle) * pentagonOffset;

            ctx.beginPath();
            // Calculate vertices for each pentagon
            for (let j = 0; j < 5; j++) {
                const vertexAngle = centerAngle + (j * (Math.PI * 2) / 5) + (Math.PI / 5); // Rotate vertices slightly
                const vx = pentagonCenterX + Math.cos(vertexAngle) * pentagonRadius;
                const vy = pentagonCenterY + Math.sin(vertexAngle) * pentagonRadius;
                if (j === 0) {
                    ctx.moveTo(vx, vy);
                } else {
                    ctx.lineTo(vx, vy);
                }
            }
            ctx.closePath();
            ctx.fill();
        }

        // 3. Draw Frozen Overlay if needed
        if (this.isFrozen) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(173, 216, 230, 0.6)'; // Light blue with 60% opacity
            ctx.fill();
            ctx.closePath();
        }

        ctx.restore(); // Restore context state
    }

    applyForce(forceX: number, forceY: number): void {
        // console.log(`Ball applyForce: BEFORE vx=${this.vx.toFixed(1)}, vy=${this.vy.toFixed(1)} | Applying force (${forceX.toFixed(1)}, ${forceY.toFixed(1)})`); // REMOVE LOG
        this.vx += forceX;
        this.vy += forceY;
        // console.log(`Ball applyForce: AFTER vx=${this.vx.toFixed(1)}, vy=${this.vy.toFixed(1)}`); // REMOVE LOG
    }

    applyKick(forceX: number, forceY: number): void {
        // Directly set velocity for now, can be additive later
        this.vx = forceX;
        this.vy = forceY;
    }

    // Method to be called by GameManager to freeze the ball
    public freeze(duration: number): void {
        this.isFrozen = true;
        this.freezeTimer = duration;
        this.vx = 0; // Stop movement immediately
        this.vy = 0;
        console.log(`Ball Frozen for ${duration}s!`);
    }

    // Method to apply ground friction
    public applyGroundFriction(): void {
        this.vx *= C.GROUND_FRICTION;
    }
} 