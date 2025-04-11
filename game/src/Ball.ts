import * as C from './Constants';

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
    // public isFrozen: boolean = false; // Add later for power-up

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = C.BALL_RADIUS;
        this.color = C.WHITE; // Default color
    }

    update(dt: number): void {
        // Apply gravity
        this.vy += C.GRAVITY * dt; // Gravity acceleration

        // Apply simple friction (adjust FRICTION constant if needed)
        const frictionFactor = C.BALL_FRICTION; // Assuming applied per-frame effectively
        this.vx *= frictionFactor;
        this.vy *= frictionFactor;

        // Update position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Update rotation based on horizontal movement
        // Angular velocity = linear velocity / radius
        this.rotation += (this.vx / this.radius) * dt;

        // Ground collision and bounce
        if (this.y + this.radius > C.GROUND_Y) {
            this.y = C.GROUND_Y - this.radius;
            this.vy *= -C.BALL_BOUNCE; // Reverse and dampen vertical velocity
            // Stronger ground friction on vx when bouncing
            this.vx *= 0.9; // Apply extra friction factor directly
        }

        // Wall collisions and bounce
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx *= -C.BALL_BOUNCE; // Reverse and dampen horizontal velocity
        } else if (this.x + this.radius > C.SCREEN_WIDTH) {
            this.x = C.SCREEN_WIDTH - this.radius;
            this.vx *= -C.BALL_BOUNCE; // Reverse and dampen horizontal velocity
        }

        // TODO: Add collision with ceiling/top boundary if needed
        // TODO: Add collision with goal posts later
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

        ctx.restore(); // Restore context state
    }

    applyForce(forceX: number, forceY: number): void {
        // Add force to existing velocity
        this.vx += forceX;
        this.vy += forceY;
        // TODO: Consider mass/delta time if implementing more realistic physics
    }

    applyKick(forceX: number, forceY: number): void {
        // Directly set velocity for now, can be additive later
        this.vx = forceX;
        this.vy = forceY;
    }
} 