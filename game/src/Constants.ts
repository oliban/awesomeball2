// Screen and Frame Rate
export const SCREEN_WIDTH = 800;
export const SCREEN_HEIGHT = 600;
export const TARGET_FPS = 60;

// Colors (Basic)
export const WHITE = '#FFFFFF';
export const BLACK = '#000000';
export const SKY_BLUE = '#87CEEB';
export const GRASS_GREEN = '#228B22';
export const GOAL_COLOR = '#FFFFFF';
export const YELLOW = '#FFFF00';

// Physics (Values adjusted for dt - less gravity!)
export const GRAVITY = 1100; // Decreased gravity (was 1400)
export const BASE_PLAYER_SPEED = 240; // Keep speed for now (pixels/sec)
export const BASE_JUMP_POWER = -450; // Adjusted jump power for lower gravity (was -500)
export const BASE_KICK_FORCE_X = 600; // Keep kick force X (pixels/sec)
export const BASE_KICK_FORCE_Y = -450; // Keep kick force Y (pixels/sec)
export const BALL_FRICTION = 0.98; // Keep friction
export const GROUND_FRICTION = 0.9; // Added ground friction for ball
export const BALL_BOUNCE = 0.85; // Keep increased bounciness
export const HEADBUTT_BOUNCE_FACTOR = 1.8; // Increased bounciness factor (was 1.1)
export const WALL_BOUNCE = 0.85; // Added, same as ball bounce for now
export const GROUND_BOUNCE = 0.85; // Added, same as ball bounce for now
export const GROUND_Y = SCREEN_HEIGHT - 50;

// Powerup Constants (Durations in seconds, multipliers as factors)
export const POWERUP_SPEED_BOOST_MULTIPLIER = 1.5; // 50% faster
export const POWERUP_SPEED_BOOST_DURATION = 10.0; 
export const POWERUP_SUPER_JUMP_MULTIPLIER = 1.4; // 40% higher jump
export const POWERUP_SUPER_JUMP_DURATION = 10.0;
export const POWERUP_BIG_PLAYER_SCALE = 1.5; // 50% bigger
export const POWERUP_BIG_PLAYER_DURATION = 12.0;
export const POWERUP_BALL_FREEZE_DURATION = 5.0;
// Add constants for Ball Freeze, Shrink, etc. later

// Player Constants (Simplified for now)
export const PLAYER_HEAD_RADIUS = 12;
export const PLAYER_TORSO_LENGTH = 36;
export const PLAYER_LIMB_WIDTH = 6;

// Ball Constants (Simplified)
export const BALL_RADIUS = 15; // Increased radius to match reference

// Field Layout
export const GOAL_WIDTH = 50; // Width of the goal opening (Ref: 50)
export const GOAL_HEIGHT = 150; // Height of the goal opening (Ref: 150)
export const GOAL_POST_THICKNESS = 8; // Thickness of posts/crossbar (Ref: 8)
export const GOAL_Y_POS = GROUND_Y - GOAL_HEIGHT; // Derived: 550 - 150 = 400
export const LEFT_GOAL_X = 0; // Position of the left goal edge (Ref: 0)
export const RIGHT_GOAL_X = SCREEN_WIDTH - GOAL_WIDTH; // Position of the right goal edge start (Ref: 800 - 50 = 750)

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

// Asset Paths (relative to the public directory)
export const ASSETS = {
    SOUNDS: {
        // Kicks
        KICK_1: '/sounds/kick_ball1.mp3',
        KICK_2: '/sounds/kick_ball2.mp3',
        KICK_3: '/sounds/kick_ball3.mp3',
        // Jump & Land
        JUMP_1: '/sounds/jump1.mp3',
        LAND_1: '/sounds/land1.mp3',
        LAND_2: '/sounds/land2.mp3',
        // Hits
        WALL_HIT_1: '/sounds/wall_hit1.mp3',
        PLAYER_BUMP_1: '/sounds/player_bump1.mp3',
        HEADBUTT_1: '/sounds/headbutt1.mp3',
        BODY_HIT_1: '/sounds/body_hit1.mp3',
        SWORD_HIT: '/sounds/sword_hit.mp3',
        CROSSBAR_HIT: '/sounds/crossbar_hit.mp3',
        BALL_BOUNCE_1: '/sounds/ball_bounce1.mp3',
        // Combos & Powerups
        COMBO_SPARKLE_1: '/sounds/combo_sparkle1.mp3',
        COMBO_SPARKLE_2: '/sounds/combo_sparkle2.mp3',
        COMBO_SPARKLE_3: '/sounds/combo_sparkle3.mp3',
        COMBO_SPARKLE_4: '/sounds/combo_sparkle4.mp3',
        // Announcements
        SUPER_JACKPOT: '/sounds/super_jackpot.mp3',
        NILS_AHEAD: '/sounds/nils_ahead.mp3',
        HARRY_AHEAD: '/sounds/harry_ahead.mp3',
        NILS_WINS: '/sounds/nils_wins.mp3',
        HARRY_WINS: '/sounds/harry_wins.mp3',
        PLAYER1_GOAL_1: '/sounds/player1_goal1.mp3',
        PLAYER1_GOAL_2: '/sounds/player1_goal2.mp3',
        PLAYER1_GOAL_3: '/sounds/player1_goal3.mp3',
        PLAYER2_GOAL_1: '/sounds/player2_goal1.mp3',
        PLAYER2_GOAL_2: '/sounds/player2_goal2.mp3',
        PLAYER2_GOAL_3: '/sounds/player2_goal3.mp3',
        // Numbers (For score/countdown)
        NUM_0: '/sounds/0.mp3',
        NUM_1: '/sounds/1.mp3',
        NUM_2: '/sounds/2.mp3',
        NUM_3: '/sounds/3.mp3',
        NUM_4: '/sounds/4.mp3',
        NUM_5: '/sounds/5.mp3',
        // Add NUM_6 to NUM_9 if needed
    }
    // Add other asset types like IMAGES later if needed
}; 