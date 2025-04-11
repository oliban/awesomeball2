// Screen and Frame Rate
export const SCREEN_WIDTH = 800;
export const SCREEN_HEIGHT = 600;
export const TARGET_FPS = 60;

// Colors (Basic)
export const WHITE = '#FFFFFF';
export const BLACK = '#000000';
export const SKY_BLUE = '#87CEEB';
export const GRASS_GREEN = '#228B22';
export const GOAL_COLOR = '#DDDDDD';
export const YELLOW = '#FFFF00';

// Physics (Values adjusted for dt - less gravity!)
export const GRAVITY = 1100; // Decreased gravity (was 1400)
export const BASE_PLAYER_SPEED = 240; // Keep speed for now (pixels/sec)
export const BASE_JUMP_POWER = -450; // Adjusted jump power for lower gravity (was -500)
export const BASE_KICK_FORCE_X = 600; // Keep kick force X (pixels/sec)
export const BASE_KICK_FORCE_Y = -450; // Keep kick force Y (pixels/sec)
export const BALL_FRICTION = 0.98; // Keep friction
export const BALL_BOUNCE = 0.85; // Keep increased bounciness
export const GROUND_Y = SCREEN_HEIGHT - 50;

// Player Constants (Simplified for now)
export const PLAYER_HEAD_RADIUS = 12;
export const PLAYER_TORSO_LENGTH = 36;
export const PLAYER_LIMB_WIDTH = 6;

// Ball Constants (Simplified)
export const BALL_RADIUS = 15; // Increased radius to match reference

// Field Layout
export const GOAL_MARGIN_X = 40;
export const GOAL_HEIGHT = 135;
export const GOAL_POST_THICKNESS = 3;
export const GOAL_Y_POS = GROUND_Y - GOAL_HEIGHT;
export const GOAL_LINE_X_LEFT = GOAL_MARGIN_X;
export const GOAL_LINE_X_RIGHT = SCREEN_WIDTH - GOAL_MARGIN_X;

// Game State
export enum GameState {
    WELCOME = 'WELCOME',
    PLAYING = 'PLAYING',
    GOAL_SCORED = 'GOAL_SCORED',
    MATCH_OVER = 'MATCH_OVER',
    GAME_OVER = 'GAME_OVER',
    TROPHY = 'TROPHY'
}

// Input Keys (Example mapping)
export const Player1Controls = {
    JUMP: 'w',
    KICK: 's',
    LEFT: 'a',
    RIGHT: 'd'
};

export const Player2Controls = {
    JUMP: 'ArrowUp',
    KICK: 'ArrowDown',
    LEFT: 'ArrowLeft',
    RIGHT: 'ArrowRight'
}; 