const BALL_RADIUS = 15;
const BALL_COLOR = '#FFFFFF';
const BALL_FRICTION = 0.99; // Slows down horizontal movement slightly each frame
const BALL_AIR_FRICTION = 0.995; // Slows down vertical movement slightly
const BALL_BOUNCE = 0.7; // Energy retained after bouncing off ground/walls

export class Ball {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    gravity: number;

    constructor(startX: number, startY: number, gravity: number) {
        this.x = startX;
        this.y = startY;
        this.vx = 0;
        this.vy = 0;
        this.radius = BALL_RADIUS;
        this.color = BALL_COLOR;
        this.gravity = gravity; // Use the same gravity as players for consistency
    }

    update(dt: number, groundY: number, screenWidth: number) {
        // Apply gravity
        this.vy += this.gravity * dt;

        // Apply air friction (simple damping)
        this.vx *= BALL_FRICTION; // Horizontal friction
        this.vy *= BALL_AIR_FRICTION; // Vertical air resistance/friction

        // Update position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Ground collision and bounce
        if (this.y + this.radius > groundY) {
            this.y = groundY - this.radius;
            this.vy *= -BALL_BOUNCE; // Reverse and dampen vertical velocity
            // Apply ground friction more strongly
            this.vx *= 0.9; 
            // Stop very small bounces/jitters
            if (Math.abs(this.vy) < 10) { // Adjust threshold as needed
                 this.vy = 0;
            }
        }

        // Wall collisions and bounce
        if (this.x + this.radius > screenWidth) {
            this.x = screenWidth - this.radius;
            this.vx *= -BALL_BOUNCE; // Reverse and dampen horizontal velocity
        } else if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx *= -BALL_BOUNCE; // Reverse and dampen horizontal velocity
        }
         // Ceiling collision (less likely but good practice)
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy *= -BALL_BOUNCE; // Reverse and dampen vertical velocity
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Base white ball
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; // Should be white
        ctx.fill();
        ctx.strokeStyle = '#555555'; // Thin grey lines for seams
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.closePath();

        // Draw simple black panels (approximating soccer pattern)
        // We need a rotation angle. Let's base it crudely on horizontal velocity & position
        const rotationAngle = (this.x * 0.05 + this.vx * 0.001) % (Math.PI * 2);

        // Number of panels to draw (adjust for look)
        const numPanels = 3;
        const panelAngleStep = (Math.PI * 2) / 5; // Simulate pentagon/hexagon structure loosely

        ctx.fillStyle = '#000000'; // Black panels

        for (let i = 0; i < numPanels; i++) {
            const angle = rotationAngle + i * panelAngleStep * 1.5; // Adjust spacing
            
            // Calculate position for a small circular panel near the edge
            // Reduce radius slightly for the panel center
            const panelRadius = this.radius * 0.35;
            const centerOffsetX = Math.cos(angle) * this.radius * 0.6;
            const centerOffsetY = Math.sin(angle) * this.radius * 0.6;

            ctx.beginPath();
            ctx.arc(this.x + centerOffsetX, this.y + centerOffsetY, panelRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
        }
    }

    // Method to apply force from a kick
    applyKick(kickForceX: number, kickForceY: number) {
         // Add the kick force directly to the velocity
         // More advanced physics could use impulse (force * time)
         this.vx += kickForceX;
         this.vy += kickForceY;
    }
} 