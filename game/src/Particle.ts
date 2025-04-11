import * as C from './Constants';

const PARTICLE_FRICTION = 0.97; // How much velocity is retained each frame (e.g., 0.97 = 3% friction)

export class Particle {
    public x: number;
    public y: number;
    public vx: number;
    public vy: number;
    public lifespan: number; // in seconds
    public initialLifespan: number; // Store initial for fading/sizing
    public color: string;
    public radius: number;
    public initialRadius: number; // Store for sizing effects
    public alpha: number = 1.0; // Add alpha property
    public gravityEffect: number; // 0 = no gravity, 1 = full gravity
    public isActive: boolean = true;
    public particleType: string = 'circle'; // ('circle', 'spark', 'smoke') 

    constructor(
        x: number, 
        y: number, 
        vx: number, 
        vy: number, 
        lifespan: number, 
        color: string, 
        radius: number = 3, 
        gravityEffect: number = 0.5, // Default to half gravity
        particleType: string = 'circle' // Allow setting type
    ) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.lifespan = lifespan;
        this.initialLifespan = lifespan; // Store for alpha/size calculation
        this.color = color;
        this.radius = radius;
        this.initialRadius = radius; // Store initial radius
        this.gravityEffect = gravityEffect;
        this.particleType = particleType;
    }

    update(dt: number): void {
        if (!this.isActive) return;

        // Apply gravity
        this.vy += C.GRAVITY * this.gravityEffect * dt;

        // Apply velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Apply friction/dampening
        this.vx *= PARTICLE_FRICTION;
        this.vy *= PARTICLE_FRICTION;

        // Decrease lifespan
        this.lifespan -= dt;
        if (this.lifespan <= 0) {
            this.alpha = 0; // Ensure alpha is 0 when inactive
            this.isActive = false;
        } else {
            // Calculate alpha based on remaining lifespan
            const linearAlpha = Math.max(0, this.lifespan / this.initialLifespan);
            
            if (this.particleType === 'smoke') {
                this.alpha = linearAlpha; // Linear fade for smoke
                // Smoke radius barely changes, maybe slight shrink
                this.radius = this.initialRadius * (0.8 + 0.2 * linearAlpha);
            } else if (this.particleType === 'spark'){
                this.alpha = linearAlpha * linearAlpha; // Quadratic fade for sparks
                // Sparks shrink based on their (quadratic) alpha
                 this.radius = this.initialRadius * this.alpha; 
            } else { // Default: treat as smoke
                 this.alpha = linearAlpha;
                 this.radius = this.initialRadius * linearAlpha; 
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.isActive || this.alpha <= 0 || this.radius <= 0.1) return;

        // Set common styles - Use globalAlpha for fading
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color; // Just use the color string directly
       
        // Always draw circles now
        // Add glow for sparks
        let originalShadowBlur = ctx.shadowBlur;
        let originalShadowColor = ctx.shadowColor;
        // Remove shadow effect logic
        /*
        if (this.particleType === 'spark') {
            ctx.shadowBlur = 8; // Adjust glow size as needed
            ctx.shadowColor = this.color; // Glow with the particle color
        }
        */

        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0.5, this.radius), 0, Math.PI * 2);
        ctx.fill();

        // Reset shadow if it was set - Remove this too
        /*
        if (this.particleType === 'spark') {
            ctx.shadowBlur = originalShadowBlur;
            ctx.shadowColor = originalShadowColor;
        }
        */

        // Reset global alpha
        ctx.globalAlpha = 1.0;
    }
} 