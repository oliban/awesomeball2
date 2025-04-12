import { Particle } from './Particle';
import * as C from './Constants';

export class ParticleSystem {
    private particles: Particle[] = [];

    addParticle(particle: Particle): void {
        this.particles.push(particle);
    }

    // Convenience method for creating common particle types
    emit(type: string, x: number, y: number, count: number = 10, options: any = {}): void {
        // console.log(`ParticleSystem: Emitting ${count} particles of type '${type}'`); // DEBUG LOG
        const scale = options.scale || 1.0; // Get scale from options, default to 1.0

        switch (type) {
            case 'dust': // Type: smoke
                const dustCount = options.count !== undefined ? options.count : 8;
                for (let i = 0; i < dustCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 35 + 10; 
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed * 0.6 - 3; 
                    const lifespan = Math.random() * 0.7 + 0.4; 
                    let radius = Math.random() * 1.6 + 1.2; // Base radius (small)
                    radius *= scale; // Apply scale if provided (e.g. from player size)
                    const color = options.color || 'rgba(139, 69, 19, 0.65)'; 
                    const gravityEffect = 0.02; 
                    this.addParticle(new Particle(x, y, vx, vy, lifespan, color, radius, gravityEffect, 'smoke'));
                }
                break;
            case 'landingDust': // Type: smoke, but larger
                 const landingDustCount = options.count !== undefined ? options.count : 12; 
                for (let i = 0; i < landingDustCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 40 + 15; 
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed * 0.5 - 5; 
                    const lifespan = Math.random() * 0.8 + 0.5; 
                    // Base radius is ~double the jump base radius
                    let radius = Math.random() * 3.4 + 2.4; 
                    // Calculate velocity scale (1x at low velocity, up to 3x max)
                    // Example: Vy=500 -> scale=2.0; Vy=1000 -> scale=3.0
                    const velocityScale = 1.0 + Math.min(2.0, Math.abs(options.landingVelocity || 0) / 500);
                    radius *= scale * velocityScale; // Apply base scale (player size) and velocity scale
                    const color = 'rgba(255, 255, 255, 0.6)'; 
                    const gravityEffect = 0.03; 
                    this.addParticle(new Particle(x, y, vx, vy, lifespan, color, radius, gravityEffect, 'smoke'));
                }
                break;
            case 'goal': // Type: spark
                 const goalCount = options.count !== undefined ? options.count : 50; 
                 for (let i = 0; i < goalCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 90 + 30; 
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed; 
                    const lifespan = Math.random() * 0.5 + 0.3; 
                    let radius = Math.random() * 1.8 + 1.2; 
                    radius *= scale; // Apply scale to goal sparks too? Maybe not desired.
                    const sparkColors = ['#FFD700', '#FFA500', '#FF4500'];
                    const color = sparkColors[Math.floor(Math.random() * sparkColors.length)]; 
                    const gravityEffect = 0.1; 
                    this.addParticle(new Particle(x, y, vx, vy, lifespan, color, radius, gravityEffect, 'spark'));
                }
                break;
             case 'jump': // Type: smoke
                const jumpCount = options.count !== undefined ? options.count : 10; 
                for (let i = 0; i < jumpCount; i++) {
                    const angle = Math.random() * Math.PI * 0.8 + Math.PI * 1.1; 
                    const speed = Math.random() * 30 + 8; 
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed * 0.7; 
                    const lifespan = Math.random() * 0.6 + 0.3; 
                    let radius = Math.random() * 1.7 + 1.2; // Reverted to smaller base radius (was 4.4 + 3.0)
                    radius *= scale; // Apply scale
                    const color = 'rgba(255, 255, 255, 0.7)'; 
                    const gravityEffect = 0.01; 
                    this.addParticle(new Particle(x, y, vx, vy, lifespan, color, radius, gravityEffect, 'smoke'));
                }
                break;
            case 'kick': // Type: spark
                 for (let i = 0; i < count; i++) { 
                    const angle = Math.random() * Math.PI * 2; 
                    const speed = Math.random() * 60 + 20; 
                    const vx = Math.cos(angle) * speed * (options.kickDirection || 1); 
                    const vy = Math.sin(angle) * speed - 15; 
                    const lifespan = Math.random() * 0.35 + 0.25; 
                    let radius = Math.random() * 1.4 + 1.1; 
                    radius *= scale; // Apply scale to kick sparks too?
                    const color = '#FFFF00'; 
                    const gravityEffect = 0.1; 
                    this.addParticle(new Particle(x, y, vx, vy, lifespan, color, radius, gravityEffect, 'spark'));
                }
                break;
            case 'explosion': // Type: mixture?
                const explosionCount = options.count !== undefined ? options.count : 50;
                const blastRadius = options.radius || 50;
                for (let i = 0; i < explosionCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * (blastRadius * 2.5) + (blastRadius * 0.5); // Speed related to radius
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed;
                    const lifespan = Math.random() * 0.6 + 0.3; // Short to medium life
                    let radius = Math.random() * 3 + 2; // Larger particles
                    radius *= scale; // Scale with player size? Probably not for explosion.
                    
                    // Mix of colors
                    const explosionColors = ['#FFA500', '#FF4500', '#FFD700', '#FFFFFF', '#808080'];
                    const color = explosionColors[Math.floor(Math.random() * explosionColors.length)];
                    
                    const gravityEffect = 0.05; // Some gravity
                    const pType = (Math.random() < 0.7) ? 'spark' : 'smoke'; // Mostly sparks
                    this.addParticle(new Particle(x, y, vx, vy, lifespan, color, radius, gravityEffect, pType));
                }
                break;
            case 'rocket_smoke': // Type: smoke (greyish)
                const smokeCount = options.count !== undefined ? options.count : 1; // Emit 1-2 per interval typically
                const baseSpeed = options.baseSpeed || 50; // Rocket's speed helps determine trail speed
                for (let i = 0; i < smokeCount; i++) {
                    // Emit slightly behind the rocket position (options.x, options.y)
                    const offsetX = (options.vx || 0) * -0.02; // Small offset back
                    const offsetY = (options.vy || 0) * -0.02;

                    // Velocity mostly opposite to rocket, with some spread
                    const spreadAngle = Math.PI / 4; // 45 degree spread
                    const baseAngle = Math.atan2(options.vy || 0, options.vx || 0) + Math.PI; // Opposite direction
                    const angle = baseAngle + (Math.random() * spreadAngle - spreadAngle / 2);

                    const speed = baseSpeed * (Math.random() * 0.2 + 0.1); // Trail speed is fraction of rocket speed
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed;
                    const lifespan = Math.random() * 0.5 + 0.3; // Shorter lifespan for smoke trail
                    let radius = Math.random() * 1.5 + 1.0;
                    radius *= scale; // Apply scale? Maybe not for rocket trail
                    const color = `rgba(150, 150, 150, ${Math.random() * 0.3 + 0.4})`; // Greyish smoke, variable alpha
                    const gravityEffect = 0.01; // Minimal gravity
                    this.addParticle(new Particle(x + offsetX, y + offsetY, vx, vy, lifespan, color, radius, gravityEffect, 'smoke'));
                }
                break;
        }
    }


    update(dt: number): void {
        // Iterate backwards to safely remove elements
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (!this.particles[i].isActive) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        for (const particle of this.particles) {
            particle.draw(ctx);
        }
    }

    clear(): void {
        this.particles = [];
    }
} 