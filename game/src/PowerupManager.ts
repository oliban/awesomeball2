import * as C from './Constants';
import { Powerup, PowerupType } from './Powerup';
import { Player } from './Player';

export class PowerupManager {
    private activePowerups: Powerup[] = [];
    private spawnTimer: number = 0;
    private minSpawnTime: number = 5; // Minimum seconds between spawns
    private maxSpawnTime: number = 15; // Maximum seconds between spawns
    private nextSpawnTime: number = 0;

    constructor() {
        this.resetSpawnTimer();
    }

    private resetSpawnTimer(): void {
        this.nextSpawnTime = Math.random() * (this.maxSpawnTime - this.minSpawnTime) + this.minSpawnTime;
        this.spawnTimer = 0; // Reset timer to 0, not the next spawn time
        // console.log(`Next powerup spawn in ${this.nextSpawnTime.toFixed(1)} seconds.`); // REMOVE DEBUG LOG
    }

    private spawnPowerup(): void {
        // Choose a random type (for now, from the basic list)
        const availableTypes = [
            PowerupType.SPEED_BOOST, 
            PowerupType.BIG_PLAYER, 
            PowerupType.SUPER_JUMP, 
            PowerupType.BALL_FREEZE,
            PowerupType.ROCKET_LAUNCHER,
            PowerupType.BOW
        ];
        const randomIndex = Math.floor(Math.random() * availableTypes.length);
        const type = availableTypes[randomIndex];

        // Spawn near top, random horizontal position
        const spawnX = Math.random() * (C.SCREEN_WIDTH - 40) + 20; // Avoid edges slightly
        const spawnY = -50; // Start above screen

        const newPowerup = new Powerup(spawnX, spawnY, type);
        this.activePowerups.push(newPowerup);
        // console.log(`Spawning powerup: ${type} at (${spawnX.toFixed(0)}, ${spawnY.toFixed(0)})`); // REMOVE DEBUG LOG

        this.resetSpawnTimer();
    }

    update(dt: number): void {
        // Update spawn timer
        this.spawnTimer += dt;
        if (this.spawnTimer >= this.nextSpawnTime) {
            this.spawnPowerup();
        }

        // Update all active powerups
        for (let i = this.activePowerups.length - 1; i >= 0; i--) {
            const powerup = this.activePowerups[i];
            powerup.update(dt);
            // Remove inactive powerups (e.g., fell off screen)
            if (!powerup.isActive) {
                this.activePowerups.splice(i, 1);
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        // Draw all active powerups
        for (const powerup of this.activePowerups) {
            powerup.draw(ctx);
        }
    }

    // Checks collision between players and powerups, returns the type of powerup collected (or null)
    checkCollisions(player: Player): PowerupType | null {
        const playerRect = player.getBodyRect(); // Use body rect for collision
        
        for (let i = this.activePowerups.length - 1; i >= 0; i--) {
            const powerup = this.activePowerups[i];
            if (!powerup.isActive) continue;

            const powerupRect = powerup.getRect();

            // Simple AABB collision check
            if (
                playerRect.x < powerupRect.x + powerupRect.width &&
                playerRect.x + playerRect.width > powerupRect.x &&
                playerRect.y < powerupRect.y + powerupRect.height &&
                playerRect.y + playerRect.height > powerupRect.y
            ) {
                // console.log(`Player collided with powerup: ${powerup.type}`); // REMOVE DEBUG LOG
                const collectedType = powerup.type;
                powerup.isActive = false; // Deactivate collected powerup
                this.activePowerups.splice(i, 1); // Remove from active list
                // TODO: Add collection sound/effect
                return collectedType;
            }
        }
        return null; // No collision
    }

    // Public method to manually add a powerup (e.g., for debugging)
    public addPowerup(powerup: Powerup): void {
        this.activePowerups.push(powerup);
    }
} 