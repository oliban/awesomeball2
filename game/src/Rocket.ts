import * as C from './Constants';
import { Player } from './Player';
import { Ball } from './Ball';
import { audioManager } from './AudioManager';

// TODO: Consider adding ParticleSystem integration for smoke trail

export class Rocket {
    public x: number;
    public y: number;
    public vx: number;
    public vy: number;
    public owner: Player; // Player who fired the rocket
    public isActive: boolean = true;
    private width: number = 20; // Size for collision and drawing
    private height: number = 8;
    private angle: number = 0; // Angle of flight based on velocity
    public lastPos: { x: number, y: number }; // For visual explosion positioning - Made public

    constructor(x: number, y: number, vx: number, vy: number, owner: Player) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.owner = owner;
        this.angle = Math.atan2(vy, vx);
        this.lastPos = { x, y };
        console.log(`Rocket created by Player ${owner.teamColor === '#DCDCDC' ? 1: 2} at (${x.toFixed(0)}, ${y.toFixed(0)}) with velocity (${vx.toFixed(0)}, ${vy.toFixed(0)})`); // Basic identification
    }

    update(dt: number): boolean { // Returns true if exploded this frame
        if (!this.isActive) return false;

        this.lastPos = { x: this.x, y: this.y }; // Store position BEFORE update

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.angle = Math.atan2(this.vy, this.vx);

        console.log(`DEBUG: Rocket Update - Pos=(${this.x.toFixed(0)},${this.y.toFixed(0)})`); // Log position

        // --- Collision Checks ---
        let exploded = false;
        let explosionCause: string | null = null; // To log what caused the explosion

        // Check Ground Collision
        if (this.y > C.GROUND_Y - (this.height / 2) ) {
             this.y = C.GROUND_Y - (this.height / 2);
            exploded = true;
            explosionCause = "ground";
        }

        // TODO: Add Rocket vs Player collision check
        // This should ideally happen in GameManager for better context

        // TODO: Add Rocket vs Ball collision check
        // Also better handled in GameManager

        // Check Screen Bounds (simple despawn for now, could explode)
        if (!exploded && (this.x < -this.width || this.x > C.SCREEN_WIDTH + this.width || this.y < -this.height)) {
            this.isActive = false;
            // console.log("Rocket went out of bounds"); // Reduce noise
            return false; // Didn't explode *in* bounds
        }

        if (exploded) {
            this.isActive = false;
            console.log(`Explosion triggered by ${explosionCause} at (${this.lastPos.x.toFixed(0)}, ${this.lastPos.y.toFixed(0)})`);
            return true; // Signal explosion happened
        }

        return false; // Still active, didn't explode
    }

    // Simple AABB rectangle for collision, centered on rocket's position
    getRect(): { x: number, y: number, width: number, height: number } {
        const rectX = this.x - this.width / 2;
        const rectY = this.y - this.height / 2;
        return { x: rectX, y: rectY, width: this.width, height: this.height };
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.isActive) return;
        console.log(`DEBUG: Drawing Rocket at (${this.x.toFixed(0)},${this.y.toFixed(0)})`); // Log draw call

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Draw rocket body (simple rectangle)
        // Centered around (0,0) after translation
        ctx.fillStyle = '#ff4500'; // Orangish-red
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.strokeStyle = C.BLACK;
        ctx.lineWidth = 1;
        ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Optional: Draw a small flame at the back
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.moveTo(-this.width / 2 - 5, 0); // Point behind the rocket
        ctx.lineTo(-this.width / 2, -this.height / 3);
        ctx.lineTo(-this.width / 2, this.height / 3);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}
