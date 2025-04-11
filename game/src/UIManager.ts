import * as C from './Constants';

// Interface for game state data needed by UI Manager
export interface UIGameState {
    currentState: C.GameState;
    player1Score: number;
    player2Score: number;
    goalMessageTimer?: number; // Optional timer for goal message
    matchOverTimer?: number; // Optional timer for match over message
    winnerName?: string; // Optional winner name for match/game over
    // Add other relevant state later: gamesWon, etc.
}

export class UIManager {
    private ctx: CanvasRenderingContext2D;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
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

    private drawGoalMessage(): void {
        this.ctx.fillStyle = C.YELLOW; 
        this.ctx.font = '60px Impact';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("GOAL!", C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 3);
    }

    private drawMatchOverMessage(score1: number, score2: number): void {
        // Determine winner based on score passed in
        const winner = score1 >= MATCH_POINT_LIMIT ? "Player 1" : "Player 2"; 
        
        this.ctx.fillStyle = C.WHITE;
        this.ctx.font = '50px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${winner} Wins Match!`, C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 2 - 30);
        this.ctx.font = '30px Arial';
        this.ctx.fillText(`Score: ${score1} - ${score2}`, C.SCREEN_WIDTH / 2, C.SCREEN_HEIGHT / 2 + 20);
    }

    // TODO: Add drawTrophyScreen method
    // TODO: Add drawBallIndicator method
    // TODO: Add drawDebugInfo method
}

// Define constants used locally if not importing all from C
const MATCH_POINT_LIMIT = 5; // Needs to match GameManager logic 