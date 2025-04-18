import * as C from './Constants';
import { ASSETS } from './Constants';
import { PowerupType, Powerup } from './Powerup';

// --- Simple Image Cache --- 
class ImageCache {
    private cache: Map<string, HTMLImageElement> = new Map();
    private loading: Set<string> = new Set();

    getImage(src: string): HTMLImageElement | null {
        if (this.cache.has(src)) {
            return this.cache.get(src)!;
        }

        if (!this.loading.has(src)) {
            this.loading.add(src);
            const img = new Image();
            img.onload = () => {
                console.log(`Image loaded: ${src}`);
                this.cache.set(src, img);
                this.loading.delete(src);
            };
            img.onerror = () => {
                console.error(`Failed to load image: ${src}`);
                this.loading.delete(src);
            };
            img.src = src;
        }

        return null; // Return null while loading
    }
}
// --------------------------

// Interface for game state data needed by UI Manager
export interface UIGameState {
    currentState: C.GameState;
    player1Score: number;
    player2Score: number;
    // Player 1 Status
    p1SpeedBoostTimer?: number;
    p1SuperJumpTimer?: number;
    p1BigPlayerTimer?: number;
    p1HasRocketLauncher?: boolean;
    p1RocketAmmo?: number;
    p1HasBow?: boolean;
    p1ArrowAmmo?: number;
    player1GoalEnlargeTimer?: number | null;
    // Player 2 Status
    p2SpeedBoostTimer?: number;
    p2SuperJumpTimer?: number;
    p2BigPlayerTimer?: number;
    p2HasRocketLauncher?: boolean;
    p2RocketAmmo?: number;
    p2HasBow?: boolean;
    p2ArrowAmmo?: number;
    player2GoalEnlargeTimer?: number | null;
    // Global Status
    ballIsFrozen?: boolean;
    ballFreezeTimer?: number; // Maybe display time remaining?
    goalMessageTimer?: number; // Optional timer for goal message
    matchOverTimer?: number | null;
    winnerName?: string | null;
    debugSelectedPowerupType?: PowerupType;
    // Add other relevant state later: gamesWon, etc.
}

export class UIManager {
    private ctx: CanvasRenderingContext2D;
    private imageCache: ImageCache;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
        this.imageCache = new ImageCache();
    }

    // Draw all relevant UI based on the game state
    draw(gameState: UIGameState) {
        // Clear is handled by GameManager before calling this
        
        switch(gameState.currentState) {
            case C.GameState.WELCOME:
                this.drawWelcomeScreen();
                break;
            case C.GameState.PLAYING:
                this.drawScoreboard(gameState.player1Score, gameState.player2Score);
                this.drawPlayerStatusText(gameState); // Draw status text
                // TODO: Add Off-screen ball indicator drawing here later
                break;
            case C.GameState.GOAL_SCORED:
                // Draw scoreboard AND goal message
                this.drawScoreboard(gameState.player1Score, gameState.player2Score);
                this.drawGoalMessage();
                break;
            case C.GameState.MATCH_OVER:
                 // Draw scoreboard AND match over message
                this.drawScoreboard(gameState.player1Score, gameState.player2Score);
                this.drawMatchOverMessage(gameState.player1Score, gameState.player2Score);
                break;
            // TODO: Add cases for GAME_OVER, TROPHY
            default:
                // Draw scoreboard as a fallback for unhandled states
                this.drawScoreboard(gameState.player1Score, gameState.player2Score);
                break;
        }
        // Draw Global Status Text (e.g., Ball Frozen)
        this.drawGlobalStatusText(gameState);
        this.drawGoalStatusText(gameState);
        this.drawDebugInfo(gameState); // Draw debug info
        
        // TODO: Draw Debug info if enabled
    }

    private drawWelcomeScreen(): void {
        this.ctx.fillStyle = C.WHITE;
        this.ctx.font = '40px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("Awesome Ball 2!", C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 2 - 50);
        this.ctx.font = '24px Arial';
        this.ctx.fillText("Press Kick or Jump to Start", C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 2);
    }

    private drawScoreboard(score1: number, score2: number): void {
        const scoreText = `${score1} - ${score2}`;
        const fontSize = 32;
        this.ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        
        // Draw outline first
        this.ctx.strokeStyle = C.BLACK;
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(scoreText, C.SCREEN_WIDTH / 2, 10);
    
        // Draw filled text
        this.ctx.fillStyle = C.WHITE;
        this.ctx.fillText(scoreText, C.SCREEN_WIDTH / 2, 10);
    }

    private drawPlayerStatusText(gameState: UIGameState): void {
        const fontSize = 14;
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.fillStyle = C.WHITE;
        this.ctx.textAlign = 'center';
        let yOffset = -80; // Start text above the player's typical head height

        // Player 1 Status Text
        // TODO: Need player actual positions passed into UIManager or gameState
        // Using fixed positions near scoreboard for now as placeholder
        const p1StatusX = C.SCREEN_WIDTH * 0.25;
        let p1StatusY = 50;
        if (gameState.p1SpeedBoostTimer && gameState.p1SpeedBoostTimer > 0) {
            this.ctx.fillText(`SPEED UP! ${gameState.p1SpeedBoostTimer.toFixed(1)}s`, p1StatusX, p1StatusY);
            p1StatusY += fontSize + 2;
        }
        if (gameState.p1SuperJumpTimer && gameState.p1SuperJumpTimer > 0) {
            this.ctx.fillText(`HIGH JUMP! ${gameState.p1SuperJumpTimer.toFixed(1)}s`, p1StatusX, p1StatusY);
            p1StatusY += fontSize + 2;
        }
        if (gameState.p1BigPlayerTimer && gameState.p1BigPlayerTimer > 0) {
            this.ctx.fillText(`BIG! ${gameState.p1BigPlayerTimer.toFixed(1)}s`, p1StatusX, p1StatusY);
            p1StatusY += fontSize + 2;
        }
        if (gameState.p1HasRocketLauncher && gameState.p1RocketAmmo !== undefined && gameState.p1RocketAmmo > 0) {
            this.ctx.fillStyle = '#FF4500'; // Orange for rockets
            this.ctx.fillText(`ROCKETS: ${gameState.p1RocketAmmo}`, p1StatusX, p1StatusY);
            this.ctx.fillStyle = C.WHITE; // Reset color
            p1StatusY += fontSize + 2;
        }
        if (gameState.p1HasBow && gameState.p1ArrowAmmo !== undefined && gameState.p1ArrowAmmo > 0) {
            this.ctx.fillStyle = '#90EE90'; // Light green for arrows
            this.ctx.fillText(`ARROWS: ${gameState.p1ArrowAmmo}`, p1StatusX, p1StatusY);
            this.ctx.fillStyle = C.WHITE; // Reset color
            p1StatusY += fontSize + 2;
        }

        // Player 2 Status Text
        const p2StatusX = C.SCREEN_WIDTH * 0.75;
        let p2StatusY = 50;
         if (gameState.p2SpeedBoostTimer && gameState.p2SpeedBoostTimer > 0) {
            this.ctx.fillText(`SPEED UP! ${gameState.p2SpeedBoostTimer.toFixed(1)}s`, p2StatusX, p2StatusY);
            p2StatusY += fontSize + 2;
        }
        if (gameState.p2SuperJumpTimer && gameState.p2SuperJumpTimer > 0) {
            this.ctx.fillText(`HIGH JUMP! ${gameState.p2SuperJumpTimer.toFixed(1)}s`, p2StatusX, p2StatusY);
            p2StatusY += fontSize + 2;
        }
        if (gameState.p2BigPlayerTimer && gameState.p2BigPlayerTimer > 0) {
            this.ctx.fillText(`BIG! ${gameState.p2BigPlayerTimer.toFixed(1)}s`, p2StatusX, p2StatusY);
            p2StatusY += fontSize + 2;
        }
        if (gameState.p2HasRocketLauncher && gameState.p2RocketAmmo !== undefined && gameState.p2RocketAmmo > 0) {
             this.ctx.fillStyle = '#FF4500'; // Orange for rockets
            this.ctx.fillText(`ROCKETS: ${gameState.p2RocketAmmo}`, p2StatusX, p2StatusY);
            this.ctx.fillStyle = C.WHITE; // Reset color
            p2StatusY += fontSize + 2;
        }
        if (gameState.p2HasBow && gameState.p2ArrowAmmo !== undefined && gameState.p2ArrowAmmo > 0) {
            this.ctx.fillStyle = '#90EE90'; // Light green for arrows
            this.ctx.fillText(`ARROWS: ${gameState.p2ArrowAmmo}`, p2StatusX, p2StatusY);
            this.ctx.fillStyle = C.WHITE; // Reset color
            p2StatusY += fontSize + 2;
        }
    }

    private drawGlobalStatusText(gameState: UIGameState): void {
        if (gameState.ballIsFrozen && gameState.ballFreezeTimer && gameState.ballFreezeTimer > 0) {
            const text = `BALL FROZEN: ${gameState.ballFreezeTimer.toFixed(1)}s`;
            this.ctx.font = `bold 18px Arial`;
            this.ctx.fillStyle = 'rgba(173, 216, 230, 0.9)'; // Light blue
            this.ctx.textAlign = 'center';
            this.ctx.fillText(text, C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT - 30); // Bottom center
        }
    }

    private drawGoalStatusText(gameState: UIGameState): void {
        const fontSize = 16;
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.fillStyle = '#FFA500'; // Orange
        this.ctx.textAlign = 'center';
        const yPos = 50; // Position below scoreboard

        // Player 1 Goal (Left side)
        if (gameState.player1GoalEnlargeTimer && gameState.player1GoalEnlargeTimer > 0) {
            const text = `P1 GOAL ENLARGED: ${gameState.player1GoalEnlargeTimer.toFixed(1)}s`;
            const xPos = C.SCREEN_WIDTH * 0.2; // Near left goal
            this.ctx.fillText(text, xPos, yPos);
        }

        // Player 2 Goal (Right side)
        if (gameState.player2GoalEnlargeTimer && gameState.player2GoalEnlargeTimer > 0) {
            const text = `P2 GOAL ENLARGED: ${gameState.player2GoalEnlargeTimer.toFixed(1)}s`;
            const xPos = C.SCREEN_WIDTH * 0.8; // Near right goal
            this.ctx.fillText(text, xPos, yPos);
        }
    }

    private drawGoalMessage(): void {
        this.ctx.fillStyle = C.YELLOW; 
        this.ctx.font = '60px Impact';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("GOAL!", C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 3);
    }

    private drawMatchOverMessage(score1: number, score2: number): void {
        // Content removed - GameManager.render() now handles the specific win message display
        // including winner name (Nils/Harry) and restart prompt.
    }

    private drawDebugInfo(gameState: UIGameState): void {
        if (gameState.debugSelectedPowerupType) {
            const type = gameState.debugSelectedPowerupType;
            
            // Define position and size for the debug icon
            const iconSize = C.POWERUP_ICON_SIZE * 1.5; // Make debug icon slightly larger
            const padding = 10;
            const textPadding = 5;
            const labelText = "Next:";
            const typeText = `${type}`;

            // Calculate text widths
            const labelFontSize = 12;
            this.ctx.font = `${labelFontSize}px Arial`;
            const labelWidth = this.ctx.measureText(labelText).width;
            const typeFontSize = 14;
            this.ctx.font = `bold ${typeFontSize}px Arial`;
            const typeWidth = this.ctx.measureText(typeText).width;

            // Calculate total width needed for the background
            const totalContentWidth = labelWidth + textPadding + iconSize + textPadding + typeWidth;
            const backgroundWidth = totalContentWidth + padding * 2;
            const backgroundHeight = iconSize + padding;
            const backgroundX = padding / 2;
            const backgroundY = padding / 2;
            const borderRadius = 5;

            // Draw rounded background rectangle
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Slightly darker background
            this.ctx.beginPath();
            this.ctx.moveTo(backgroundX + borderRadius, backgroundY);
            this.ctx.lineTo(backgroundX + backgroundWidth - borderRadius, backgroundY);
            this.ctx.quadraticCurveTo(backgroundX + backgroundWidth, backgroundY, backgroundX + backgroundWidth, backgroundY + borderRadius);
            this.ctx.lineTo(backgroundX + backgroundWidth, backgroundY + backgroundHeight - borderRadius);
            this.ctx.quadraticCurveTo(backgroundX + backgroundWidth, backgroundY + backgroundHeight, backgroundX + backgroundWidth - borderRadius, backgroundY + backgroundHeight);
            this.ctx.lineTo(backgroundX + borderRadius, backgroundY + backgroundHeight);
            this.ctx.quadraticCurveTo(backgroundX, backgroundY + backgroundHeight, backgroundX, backgroundY + backgroundHeight - borderRadius);
            this.ctx.lineTo(backgroundX, backgroundY + borderRadius);
            this.ctx.quadraticCurveTo(backgroundX, backgroundY, backgroundX + borderRadius, backgroundY);
            this.ctx.closePath();
            this.ctx.fill();

            // Define drawing positions relative to the background
            const contentY = backgroundY + backgroundHeight / 2;
            let currentX = backgroundX + padding;

            // Draw "Next:" label
            this.ctx.font = `${labelFontSize}px Arial`;
            this.ctx.fillStyle = '#cccccc'; // Lighter grey for label
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(labelText, currentX, contentY);
            currentX += labelWidth + textPadding;

            // Draw the powerup symbol
            const iconCenterX = currentX + iconSize / 2;
            Powerup.drawSymbol(this.ctx, type, iconCenterX, contentY, iconSize);
            currentX += iconSize + textPadding;

            // Draw text label (Powerup Type)
            this.ctx.font = `bold ${typeFontSize}px Arial`;
            this.ctx.fillStyle = C.WHITE;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle'; 
            this.ctx.fillText(typeText, currentX, contentY);
        }
    }

    // TODO: Add drawTrophyScreen method
    // TODO: Add drawBallIndicator method
}

// Define constants used locally if not importing all from C
const MATCH_POINT_LIMIT = 5; // Needs to match GameManager logic 