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
export const GRAVITY = 980; // Adjusted gravity (pixels/s^2)
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
export const POWERUP_GOAL_ENLARGE_DURATION = 30.0; // Duration for enlarged goal
export const POWERUP_GOAL_ENLARGE_FACTOR = 1.4; // Multiplier for goal size
// Add constants for Ball Freeze, Shrink, etc. later

// Player Constants (Simplified for now)
export const PLAYER_HEAD_RADIUS = 12;
export const PLAYER_TORSO_LENGTH = 36;
export const PLAYER_LIMB_WIDTH = 6;

// Ball Constants (Simplified)
export const BALL_RADIUS = 15; // Increased radius to match reference

// Field Layout
export const GOAL_WIDTH = 80;
export const GOAL_HEIGHT = 150; // Distance from ground to crossbar
export const GOAL_POST_THICKNESS = 10;
export const GOAL_Y_POS = GROUND_Y - GOAL_HEIGHT; // Y coordinate of the top of the goal posts/bottom of crossbar
export const LEFT_GOAL_X = 0; // Left edge of the left goal box
export const RIGHT_GOAL_X = SCREEN_WIDTH - GOAL_WIDTH; // Left edge of the right goal box

// Define Goal Line X coordinates for collision/scoring
export const GOAL_LINE_X_LEFT = LEFT_GOAL_X; // Line P2 scores in
export const GOAL_LINE_X_RIGHT = RIGHT_GOAL_X + GOAL_WIDTH; // Line P1 scores in

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
        KICK_1: 'sounds/kick_ball1.mp3',
        KICK_2: 'sounds/kick_ball2.mp3',
        KICK_3: 'sounds/kick_ball3.mp3',
        // Jump & Land
        JUMP_1: 'sounds/jump1.mp3',
        LAND_1: 'sounds/land1.mp3',
        LAND_2: 'sounds/land2.mp3',
        // Hits
        WALL_HIT_1: 'sounds/wall_hit1.mp3',
        PLAYER_BUMP_1: 'sounds/player_bump1.mp3',
        HEADBUTT_1: 'sounds/headbutt1.mp3',
        BODY_HIT_1: 'sounds/body_hit1.mp3',
        SWORD_HIT: 'sounds/sword_hit.mp3',
        SWORD_HIT_BALL: 'sounds/sword_hit.mp3',
        CROSSBAR_HIT: 'sounds/crossbar_hit.mp3',
        BALL_BOUNCE_1: 'sounds/ball_bounce1.mp3',
        // Combos & Powerups
        COMBO_SPARKLE_1: 'sounds/combo_sparkle1.mp3',
        COMBO_SPARKLE_2: 'sounds/combo_sparkle2.mp3',
        COMBO_SPARKLE_3: 'sounds/combo_sparkle3.mp3',
        COMBO_SPARKLE_4: 'sounds/combo_sparkle4.mp3',
        // Announcements
        SUPER_JACKPOT: 'sounds/super_jackpot.mp3',
        NILS_AHEAD: 'sounds/nils_ahead.mp3',
        HARRY_AHEAD: 'sounds/harry_ahead.mp3',
        NILS_WINS: 'sounds/nils_wins.mp3',
        HARRY_WINS: 'sounds/harry_wins.mp3',
        PLAYER1_GOAL_1: 'sounds/player1_goal1.mp3',
        PLAYER1_GOAL_2: 'sounds/player1_goal2.mp3',
        PLAYER1_GOAL_3: 'sounds/player1_goal3.mp3',
        PLAYER2_GOAL_1: 'sounds/player2_goal1.mp3',
        PLAYER2_GOAL_2: 'sounds/player2_goal2.mp3',
        PLAYER2_GOAL_3: 'sounds/player2_goal3.mp3',
        // Numbers (For score/countdown)
        NUM_0: 'sounds/0.mp3',
        NUM_1: 'sounds/1.mp3',
        NUM_2: 'sounds/2.mp3',
        NUM_3: 'sounds/3.mp3',
        NUM_4: 'sounds/4.mp3',
        NUM_5: 'sounds/5.mp3',
        // Add NUM_6 to NUM_9 if needed
    }
    // Add other asset types like IMAGES later if needed
};

// Player Animation Constants
export const STAND_ANGLE = Math.PI / 2; // Angle for standing limbs (pointing down) 

export const KICK_IMPACT_END = 0.6;       // End of impact phase

// Kick Interaction Constants
export const KICK_HEAD_PUSHBACK_FORCE_X = 600; // Further Increased Horizontal force
export const KICK_HEAD_PUSHBACK_FORCE_Y = 200; // Slightly Decreased Upward force
export const PUSHBACK_DURATION = 0.2; // Duration (in seconds) the player is pushed back and ignores input

// POWERUPS
// ... existing code ... 

// Rocket Launcher Constants
export const ROCKET_SPEED = 400; // pixels per second
export const ROCKET_BLAST_RADIUS = 80; // pixels
export const ROCKET_EXPLOSION_FORCE = 800; // Magnitude of pushback
export const ROCKET_PLAYER_UPWARD_BOOST = 150; // Extra upward push for players in blast
export const ROCKET_BALL_UPWARD_BOOST = 100; // Upward push for ball in blast
export const ROCKET_TUMBLE_DURATION = 1.5; // seconds player tumbles after hit
export const EXPLOSION_RADIUS = 80; // pixels
export const EXPLOSION_UPWARD_FORCE = -400; // pixels/sec vertical velocity applied on hit

// Bow and Arrow Constants
export const ARROW_SPEED = 600; // pixels per second
export const ARROW_GRAVITY = 400; // Gravity affecting arrows (lower than players)
export const ARROW_DAMAGE_FORCE = 400; // Magnitude of pushback from arrow hit
export const ARROW_TUMBLE_DURATION = 1.0; // seconds player tumbles after hit by arrow
export const BOW_SWAY_SPEED = 0.3; // Cycles per second for the auto-aim sway
export const BOW_SWAY_ANGLE_MAX = Math.PI / 3; // Increased max angle again (was PI / 5 -> approx 60 degrees total)

// Sword Constants
export const SWORD_HIT_FORCE = 600; // Pushback force when sword hits a player
export const SWORD_BALL_FORCE = 800; // Force applied to the ball when hit by sword
export const SWORD_TUMBLE_ROTATION_SPEED = 6 * Math.PI; // Rotation speed for sword tumble (radians/sec)

// Other constants as needed... 