import * as C from './Constants';
import { Player } from './Player';
import { ParticleSystem } from './ParticleSystem';
// Import Point if it's in a separate Utils file
// import { Point } from './Utils';
// Basic Point type if not imported
interface Point { x: number; y: number; }

export enum ArrowState {
    FLYING = 'FLYING',
    STUCK = 'STUCK'
}

// Need calculateEndPoint function (or import from Utils)
function calculateEndPoint(start: Point, length: number, angle: number): Point {
    return {
        x: start.x + length * Math.cos(angle),
        y: start.y - length * Math.sin(angle) // Canvas Y is inverted
    };
}

export class Arrow {
    public x: number;
    public y: number;
    public vx: number;
    public vy: number;
    public owner: Player; // Player who fired the arrow
    public isActive: boolean = true; // Active means it's in the game world (flying or stuck)
    public state: ArrowState = ArrowState.FLYING;
    private width: number = 30; // Length of the arrow
    private thickness: number = 2;
    public angle: number = 0; // Angle of flight/sticking
    public stuckToObject: any = null; // Reference to object it's stuck in (e.g., player, ground, wall type string)
    public stuckOffsetX: number = 0; // Relative position where it stuck from target center
    public stuckOffsetY: number = 0;
    private lastPos: { x: number, y: number }; // For collision detection
    private particleSystem?: ParticleSystem; // Optional particle system for effects

    private readonly length: number = 30; // Length of the arrow shaft
    private readonly headSize: number = 6; // Size of the arrowhead

    constructor(x: number, y: number, vx: number, vy: number, owner: Player, particleSystem?: ParticleSystem) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.owner = owner;
        this.angle = Math.atan2(vy, vx);
        this.lastPos = { x, y };
        this.particleSystem = particleSystem;
        // console.log(`Arrow created by Player ${owner.teamColor} at (${x.toFixed(0)}, ${y.toFixed(0)}) with velocity (${vx.toFixed(0)}, ${vy.toFixed(0)})`);
    }

    update(dt: number): boolean { // Returns true if hit something this frame
        if (!this.isActive) return false;

        this.lastPos = { x: this.x, y: this.y }; // Store position BEFORE update

        if (this.state === ArrowState.FLYING) {
            // Apply gravity
            this.vy += C.GRAVITY * dt;

            // Update position
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            // Update angle based on velocity vector
            this.angle = Math.atan2(this.vy, this.vx);

            // Simple out-of-bounds check (deactivate)
            // Add check for hitting ground
            if (this.y >= C.GROUND_Y - (this.thickness / 2)) {
                 this.stick('ground', this.x, C.GROUND_Y - (this.thickness / 2));
            }
            // Deactivate if way off screen
            else if (this.x < -this.width * 2 || this.x > C.SCREEN_WIDTH + this.width * 2 || this.y > C.SCREEN_HEIGHT + 100) {
                 this.isActive = false;
            }
        } else if (this.state === ArrowState.STUCK) {
             // If stuck to a moving object (like a player), update position based on target
             if (this.stuckToObject && typeof this.stuckToObject === 'object' && 'x' in this.stuckToObject && 'y' in this.stuckToObject) {
                 // Simple attachment - doesn't account for target rotation or player scaling
                 this.x = this.stuckToObject.x + this.stuckOffsetX;
                 this.y = this.stuckToObject.y + this.stuckOffsetY;
                 // TODO: Make stuck angle match player angle?
             }
             // Otherwise, position stays fixed where it stuck
        }

        // --- Collision Checks (Basic) ---
        let hitSomething = false;
        let hitCause: string | null = null;

        // Check Ground Collision
        if (this.y > C.GROUND_Y) {
            this.y = C.GROUND_Y; // Stick arrow in the ground
            this.vx = 0;         // Stop movement
            this.vy = 0;
            this.isActive = false; // Arrow is no longer moving/dangerous
            hitSomething = true;
            hitCause = "ground";
            // TODO: Could add a slight "thud" particle effect here
        }

        // Check Screen Bounds (Despawn if goes too far off)
        if (!hitSomething && (this.x < -this.length || this.x > C.SCREEN_WIDTH + this.length || this.y < -this.length)) {
            this.isActive = false; 
            // console.log("Arrow went out of bounds");
            return false; // Didn't hit anything *in* bounds
        }

        if (hitSomething) {
            // console.log(`Arrow hit ${hitCause} at (${this.lastPos.x.toFixed(0)}, ${this.lastPos.y.toFixed(0)})`);
            return true; // Signal hit occurred
        }

        return false; // Still active, didn't hit anything
    }

    // Method to call when arrow hits something
    stick(target: any, hitX: number, hitY: number): void {
        if (this.state === ArrowState.FLYING) {
            this.state = ArrowState.STUCK;
            this.stuckToObject = target; // Store the target (could be string like 'ground', 'wall', or an object like Player/Ball)
            this.x = hitX; // Set position to exact hit point
            this.y = hitY;
            // Keep angle from moment of impact for visual orientation
            this.angle = Math.atan2(this.vy, this.vx);
            this.vx = 0;
            this.vy = 0;

             // If stuck to an object, calculate relative offset from its center (assuming x,y is center)
            if (target && typeof target === 'object' && 'x' in target && 'y' in target) {
                 this.stuckOffsetX = hitX - target.x;
                 this.stuckOffsetY = hitY - target.y;
                 // Determine target type for logging/effects
                 let targetName = target.constructor?.name || 'object';
                 if (target instanceof Player) targetName = "Player"; 
                //  if (target instanceof Ball) targetName = "Ball"; // If Ball collision added
                 console.log(`Arrow Stuck to ${targetName} at relative offset (${this.stuckOffsetX.toFixed(1)}, ${this.stuckOffsetY.toFixed(1)})`);

            } else {
                 // Stuck to a static element like 'ground' or 'wall'
                 console.log(`Arrow Stuck to ${target} at (${hitX.toFixed(1)}, ${hitY.toFixed(1)})`);
            }
        }
    }

    // Helper to get the tip position for collision detection
    getTipPosition(): Point {
        // Use standard math angle calculation with inverted Y
        return calculateEndPoint({x: this.x, y: this.y}, this.width * 0.5, this.angle);
    }
    // Helper to get the base position
    getBasePosition(): Point {
        // Use standard math angle calculation with inverted Y
         return calculateEndPoint({x: this.x, y: this.y}, -this.width * 0.5, this.angle);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.isActive) return;

        // --- REMOVED DEBUG DRAWING --- 
        // Draw Arrow Position
        // ctx.fillStyle = 'magenta'; // Use a distinct color
        // ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
        // 
        // Draw Velocity Vector (scaled for visibility)
        // ctx.strokeStyle = 'cyan'; // Distinct color
        // ctx.lineWidth = 1;
        // ctx.beginPath();
        // ctx.moveTo(this.x, this.y);
        // const scale = 0.1; // Scale factor for vector visibility
        // Draw line based directly on stored vx, vy
        // ctx.lineTo(this.x + this.vx * scale, this.y + this.vy * scale); 
        // ctx.stroke();
        // --- END REMOVED DEBUG DRAWING ---

        // UNCOMMENTED: Original Drawing Code 
        
        ctx.save();
        ctx.translate(this.x, this.y);
         // Rotate based on the calculated angle (0=right, positive=CW in canvas)
         // ctx.rotate(-this.angle); // Reverting TEST
         ctx.rotate(this.angle); // Back to original

        // Draw arrow shaft
        ctx.strokeStyle = this.owner.teamColor;
        ctx.lineWidth = this.thickness;
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, 0); // Tail
        ctx.lineTo(this.width / 2, 0); // Tip
        ctx.stroke();

        // Draw arrowhead
        ctx.fillStyle = C.BLACK;
        ctx.beginPath();
        ctx.moveTo(this.width / 2, 0); // Tip point
        ctx.lineTo(this.width / 2 - 6, -3);
        ctx.lineTo(this.width / 2 - 6, 3);
        ctx.closePath();
        ctx.fill();

        // Draw fletching (tail feathers)
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#A0522D'; // Sienna brown feathers
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, 0);
        ctx.lineTo(-this.width / 2 - 5, -4);
        ctx.moveTo(-this.width / 2, 0);
        ctx.lineTo(-this.width / 2 - 5, 4);
        ctx.moveTo(-this.width / 2 - 2, 0);
        ctx.lineTo(-this.width / 2 - 7, -4);
        ctx.moveTo(-this.width / 2 - 2, 0);
        ctx.lineTo(-this.width / 2 - 7, 4);
        ctx.stroke();

        ctx.restore();
    }

    // Bounding box for rough collision (rotated)
    // More accurate collision might require line segment intersection
    getCollisionShape(): { p1: Point, p2: Point, radius: number } {
        // Return a line segment representing the arrow shaft
        const halfLength = this.length / 2;
        const startX = this.x - Math.cos(this.angle) * halfLength;
        const startY = this.y - Math.sin(this.angle) * halfLength;
        const endX = this.x + Math.cos(this.angle) * halfLength;
        const endY = this.y + Math.sin(this.angle) * halfLength;
        return { 
            p1: { x: startX, y: startY }, 
            p2: { x: endX, y: endY },
            radius: this.thickness / 2 // Radius for thicker collision check if needed
        };
    }
}
