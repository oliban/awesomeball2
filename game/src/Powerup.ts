import * as C from './Constants';

// Enum defining the types of power-ups
export enum PowerupType {
    SPEED_BOOST = 'SPEED_BOOST',
    BIG_PLAYER = 'BIG_PLAYER',
    SUPER_JUMP = 'SUPER_JUMP',
    BALL_FREEZE = 'BALL_FREEZE',
    ROCKET_LAUNCHER = 'ROCKET_LAUNCHER',
    BOW = 'BOW',
    // Add more later: GOAL_SHIELD, SHRINK_OPPONENT, etc.
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
    private descendSpeed: number = 80; // SLIGHTLY slower descent with chute

    // Sway properties
    private swayTimer: number = 0;
    private swayMagnitude: number = 8; // Max horizontal offset (Reduced)
    private swayFrequency: number = 2.0; // Oscillations per second
    public currentSwayOffset: number = 0; // Public for easy access in draw

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

            // Update Sway if parachuting
            if (this.hasParachute) {
                this.swayTimer += dt;
                this.currentSwayOffset = Math.sin(this.swayTimer * this.swayFrequency * 2 * Math.PI) * this.swayMagnitude;
            } else {
                this.currentSwayOffset = 0; // Stop swaying when chute detaches
            }

            // Detach parachute when near the ground
            if (this.hasParachute && this.y > C.GROUND_Y - (this.height * 3)) { // Detach a bit higher
                this.hasParachute = false;
                this.vy = 150; // Fall a bit faster without chute
                this.currentSwayOffset = 0; // Ensure sway stops
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

        // Apply sway offset to the base X position for drawing
        const baseDrawX = this.x + this.currentSwayOffset;

        const boxX = baseDrawX; // Use swayed X for the box
        const boxY = this.y;
        const boxW = this.width;
        const boxH = this.height;

        // Draw Parachute if applicable
        if (this.hasParachute) {
            const chuteWidth = boxW * 2.0; // Slightly smaller chute
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
            // Connect lines to the *original* box position, not the swayed one, for visual effect
            ctx.moveTo(chuteX, chuteY + chuteHeight); // Left canopy edge (also swayed)
            ctx.lineTo(boxX, boxY); // Top-left corner of swayed box
            ctx.moveTo(chuteX + chuteWidth, chuteY + chuteHeight); // Right canopy edge (also swayed)
            ctx.lineTo(boxX + boxW, boxY); // Top-right corner of swayed box
            ctx.stroke();
        }

        // --- Draw Specific Icon based on Type --- 
        ctx.save();
        ctx.translate(boxX + boxW / 2, boxY + boxH / 2); // Center coordinates for easier drawing

        // Draw background box first
        ctx.fillStyle = C.WHITE; // White background
        ctx.strokeStyle = C.BLACK; 
        ctx.lineWidth = 1; // Thinner border for the box
        ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
        ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

        // Common style for icons (applied AFTER box)
        ctx.lineWidth = 2;
        ctx.strokeStyle = C.BLACK;

        switch (this.type) {
            case PowerupType.SPEED_BOOST:
                ctx.fillStyle = '#FFFF00'; // Yellow
                ctx.beginPath(); // Lightning bolt shape
                ctx.moveTo(-boxW * 0.1, -boxH * 0.4);
                ctx.lineTo(boxW * 0.3, 0);
                ctx.lineTo(boxW * 0.1, boxH * 0.4);
                ctx.lineTo(-boxW * 0.3, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
            case PowerupType.BIG_PLAYER:
                ctx.fillStyle = '#FF0000'; // Red
                ctx.beginPath(); // Upwards arrow
                ctx.moveTo(0, -boxH * 0.3);
                ctx.lineTo(boxW * 0.3, 0);
                ctx.lineTo(boxW * 0.1, 0);
                ctx.lineTo(boxW * 0.1, boxH * 0.3);
                ctx.lineTo(-boxW * 0.1, boxH * 0.3);
                ctx.lineTo(-boxW * 0.1, 0);
                ctx.lineTo(-boxW * 0.3, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
            case PowerupType.SUPER_JUMP:
                ctx.fillStyle = '#00FF00'; // Green
                ctx.beginPath(); // Spring shape (simplified)
                ctx.moveTo(-boxW * 0.3, boxH * 0.3);
                ctx.quadraticCurveTo(0, -boxH * 0.1, boxW * 0.3, boxH * 0.3);
                ctx.moveTo(-boxW * 0.3, boxH * 0.1);
                ctx.quadraticCurveTo(0, -boxH * 0.3, boxW * 0.3, boxH * 0.1);
                ctx.stroke(); // Just stroke for spring
                break;
            case PowerupType.BALL_FREEZE:
                ctx.fillStyle = '#00FFFF'; // Cyan
                ctx.beginPath(); // Snowflake shape (simplified)
                for (let i = 0; i < 6; i++) {
                    const angle = Math.PI / 3 * i;
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(angle) * boxW * 0.4, Math.sin(angle) * boxH * 0.4);
                }
                ctx.stroke();
                // Draw a circle in the middle
                ctx.beginPath();
                ctx.arc(0, 0, boxW * 0.15, 0, Math.PI * 2);
                ctx.fill();
                break;
            case PowerupType.ROCKET_LAUNCHER:
                ctx.fillStyle = '#808080'; // Grey
                // Simple rocket shape
                ctx.fillRect(-boxW * 0.1, -boxH * 0.4, boxW * 0.2, boxH * 0.8);
                ctx.beginPath(); // Triangle nose
                ctx.moveTo(-boxW * 0.1, -boxH * 0.4);
                ctx.lineTo(boxW * 0.1, -boxH * 0.4);
                ctx.lineTo(0, -boxH * 0.6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // Fins (optional)
                ctx.fillRect(-boxW * 0.2, boxH * 0.2, boxW * 0.4, boxH * 0.1);
                break;
            case PowerupType.BOW:
                ctx.fillStyle = '#8B4513'; // SaddleBrown
                ctx.strokeStyle = C.BLACK;
                ctx.lineWidth = 2;
                // Draw Bow shape (arc)
                ctx.beginPath();
                ctx.arc(0, 0, boxW * 0.35, Math.PI * 0.6, Math.PI * 1.4); // Arc for bow limb
                ctx.stroke();
                // Draw Bow string
                ctx.beginPath();
                ctx.moveTo(0, -boxH * 0.35);
                ctx.lineTo(0, boxH * 0.35);
                ctx.stroke();
                break;
            default:
                // Fallback to purple box if type is unknown
                ctx.fillStyle = 'purple'; 
                ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
                ctx.strokeStyle = C.WHITE;
                ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
        }

        ctx.restore();
        // ---------------------------------------
    }

    // Helper method for collision detection
    getRect(): { x: number, y: number, width: number, height: number } {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
} 