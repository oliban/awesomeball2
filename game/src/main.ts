import './style.css'
import { GameManager } from './GameManager'
import * as C from './Constants'
import { audioManager } from './AudioManager'

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    // const welcomeScreen = document.getElementById('welcome-screen'); // Removed
    // const gameContainer = document.getElementById('game-container'); // Removed

    if (!canvas /* || !welcomeScreen || !gameContainer */) { // Adjusted condition
        console.error("Canvas element not found!"); // Simplified error message
        return;
    }

    canvas.width = C.SCREEN_WIDTH;
    canvas.height = C.SCREEN_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Failed to get 2D context!");
        return;
    }

    // console.log("Canvas and context initialized.");

    // console.log("Initiating sound loading...");
    audioManager.loadSounds().then(() => {
        // console.log("Sound loading process completed (or already done).");
    }).catch(error => {
        console.error("Sound loading failed:", error);
    });

    // --- Game initialization moved back to main scope --- 
    const gameManager = new GameManager(ctx);
    gameManager.start();

    // --- Removed key press handler --- 
    // const handleKeyPress = ... 
    // document.removeEventListener('keydown', handleKeyPress);
    // document.addEventListener('keydown', handleKeyPress);
});
