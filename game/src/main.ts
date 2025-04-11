import './style.css'
import { GameManager } from './GameManager'
import * as C from './Constants'
import { audioManager } from './AudioManager'

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }

    canvas.width = C.SCREEN_WIDTH;
    canvas.height = C.SCREEN_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Failed to get 2D context!");
        return;
    }

    console.log("Canvas and context initialized.");

    console.log("Initiating sound loading...");
    audioManager.loadSounds().then(() => {
        console.log("Sound loading process completed (or already done).");
    }).catch(error => {
        console.error("Sound loading failed:", error);
    });

    const gameManager = new GameManager(ctx);
    gameManager.start();
});
