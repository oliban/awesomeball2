import * as C from './Constants';

// Enum defining the types of power-ups
export enum PowerupType {
    SPEED_BOOST = 'SPEED_BOOST',
    BIG_PLAYER = 'BIG_PLAYER',
    SUPER_JUMP = 'SUPER_JUMP',
    BALL_FREEZE = 'BALL_FREEZE',
    // Add more later: ROCKET_LAUNCHER, GOAL_SHIELD, SHRINK_OPPONENT, etc.
}

// Base class for all power-ups
export class Powerup {
    public x: number;
    public y: number;
    public vx: number;
    public vy: number;
    public type: PowerupType;
    public width: number = 30; // Example size
    public height: number = 30; // Example size
    public isActive: boolean = true;
    public hasParachute: boolean = true; // Most powerups start with one

    private driftSpeed: number = 30; // Horizontal drift speed
    private descendSpeed: number = 100; // Vertical descend speed

    constructor(x: number, y: number, type: PowerupType) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.vy = this.descendSpeed; // Start descending
        // Random initial drift direction
        this.vx = (Math.random() < 0.5 ? -1 : 1) * this.driftSpeed;
    }

    update(dt: number): void {
        if (!this.isActive) return;

        // Apply physics only if not on ground
        if (this.y < C.GROUND_Y - this.height) {
            // Basic physics: Apply velocity
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            // Simple horizontal boundary check (reverse drift)
            if (this.x < 0 || this.x + this.width > C.SCREEN_WIDTH) {
                this.vx *= -1;
                this.x = Math.max(0, Math.min(this.x, C.SCREEN_WIDTH - this.width)); // Clamp position
            }

            // Detach parachute when near the ground
            if (this.hasParachute && this.y > C.GROUND_Y - (this.height * 3)) { // Detach a bit higher
                this.hasParachute = false;
                // Optional: Slightly change physics (e.g., stop drifting)
                // this.vx = 0;
            }
        } else {
            // Landed on the ground
            this.y = C.GROUND_Y - this.height; // Snap to ground
            this.vx = 0; // Stop horizontal movement
            this.vy = 0; // Stop vertical movement
            this.hasParachute = false; // Ensure parachute is gone
        }

        // Deactivate if it falls off the bottom of the screen (redundant if landing works, but safe fallback)
        if (this.y > C.SCREEN_HEIGHT) {
            this.isActive = false;
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.isActive) return;

        const boxX = this.x;
        const boxY = this.y;
        const boxW = this.width;
        const boxH = this.height;

        // Draw Parachute if applicable
        if (this.hasParachute) {
            const chuteWidth = boxW * 2.5;
            const chuteHeight = boxH * 1.5;
            const chuteX = boxX + boxW / 2 - chuteWidth / 2;
            const chuteY = boxY - chuteHeight - boxH * 0.2; // Position above the box

            // Draw canopy (simple arc)
            ctx.fillStyle = C.WHITE; // White canopy
            ctx.strokeStyle = C.BLACK;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(chuteX + chuteWidth / 2, chuteY + chuteHeight, chuteWidth / 2, Math.PI, 0); // Semicircle
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Draw lines from canopy edges to box corners
            ctx.beginPath();
            ctx.moveTo(chuteX, chuteY + chuteHeight); // Left canopy edge
            ctx.lineTo(boxX, boxY); // Top-left box corner
            ctx.moveTo(chuteX + chuteWidth, chuteY + chuteHeight); // Right canopy edge
            ctx.lineTo(boxX + boxW, boxY); // Top-right box corner
            ctx.stroke();
        }

        // Draw the Powerup Box itself (over chute lines)
        ctx.fillStyle = 'purple'; // Placeholder color
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = C.WHITE;
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // TODO: Draw specific icon inside the box based on type
    }

    // Helper method for collision detection
    getRect(): { x: number, y: number, width: number, height: number } {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
} 