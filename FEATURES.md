# Awesome Ball 2 - Feature List (Based on Python Reference)

This document outlines the features identified in the Python reference project (`reference/awesome-ball`).

## Core Gameplay Mechanics

1.  **Two Players (Local Multiplayer):** Designed for two players on the same computer.
2.  **Player Characters (Stick Figures):**
    *   Representation: Stick figures.
    *   Movement: Run left/right (`BASE_PLAYER_SPEED`), jump (`BASE_JUMP_POWER`).
    *   Physics: Velocity, acceleration, gravity (`GRAVITY` constant likely applied each frame), bounce.
    *   Interactions: Kick ball (`BASE_KICK_FORCE_X/Y`), headbutt ball (`HEADBUTT_..._FORCE` constants).
    *   Animations: 
        *   Walk cycle (driven by `walk_cycle_timer` and `..._SWING`, `..._BEND` angle constants).
        *   Jump (using `JUMP_...` angle constants).
        *   Kick (timed animation `kick_timer`/`kick_duration` with `KICK_..._ANGLE` constants for windup, impact, follow-through).
        *   Tumble/fall (lasts `TUMBLE_DURATION`, rotates with random velocity damped by `PLAYER_TUMBLE_DAMPING`).
    *   States: Normal, jumping, kicking, stunned, tumbling.
3.  **Ball:**
    *   Physics: 
        *   Movement, gravity (`GRAVITY` constant).
        *   Friction (`BALL_FRICTION` constant slows velocity, extra ground friction on `vx`).
        *   Bounce: Reverses and damps `vy` on ground contact (`BALL_BOUNCE`), slightly less bounce off walls (`BALL_BOUNCE * 0.8`), specific bounce logic for goal shields (`BALL_BOUNCE`).
        *   Angular Bounce: Bounce angle calculated off posts/crossbar based on hit location, affecting both `vx` and `vy`.
    *   Interaction: Can be kicked/headbutted by players (velocity determined by kick/headbutt force constants).
4.  **Field:**
    *   Boundaries: Sides, top (invisible walls), ground.
    *   Goals: Two goals at each end with specific dimensions.
5.  **Scoring System:**
    *   Score points when the ball enters the opponent's goal.
    *   Match Structure: Play until a player reaches 5 goals (`MATCH_POINT_LIMIT`).
    *   Game Structure: Win 5 matches (`GAME_WIN_LIMIT`) to win the game.
6.  **Collision Handling:**
    *   Methods: Uses Pygame's `colliderect`, `collidepoint`, `clipline`.
    *   Player vs. Ball (kick, headbutt, body): Body collisions involve bounce (`PLAYER_BODY_BOUNCE`), velocity transfer (`PLAYER_VEL_TRANSFER`), minimum bounce speed (`MIN_BODY_BOUNCE_VEL`), and a brief cooldown (`PLAYER_BODY_COLLISION_FRAMES`).
    *   Ball vs. Walls/Ground/Goal Posts/Shields.
    *   Player vs. Player: Similar bounce physics as player-body-ball collision.
    *   Player Kick vs. Player: If kick impact point hits opponent (not tumbling), likely triggers stun/tumble.
    *   Player Sword vs. Player: Sword (powerup) collides as a line, likely triggers stun/tumble.
    *   Rocket vs. Player/Ball: Rockets (powerup) collide with players and ball.
    *   Player vs. Powerup: Simple rect collision for pickup.
    *   Player vs. Goal Crossbar (standing on).

## Visual Elements and Effects

7.  **Rendering:** 2D rendering (will use HTML5 Canvas).
8.  **Graphics:** Stick figures, ball, goals, field (grass), background (sky).
9.  **Time of Day Cycle:** Changes background colors and visuals (stars/moon) based on time.
10. **Particle Effects:**
    *   Goal scoring explosions.
    *   Smoke/dust effects (e.g., landings).
    *   Weather effects (rain, snow).
11. **Scoreboard:** Displays current match score and total games won. Shows messages (e.g., "GOAL!").
12. **Indicators:** Off-screen arrow pointing to the ball.
13. **Screen Flash:** Brief white flash on certain events (e.g., goal).

## Audio

14. **Sound System:** Load and play sound effects.
15. **Sound Queue:** System for queueing sounds and announcements.
16. **Sound Effects:** Specific sound files identified:
    *   **Kick:** `kick_ball1.wav`, `kick_ball2.wav`
    *   **Jump:** `jump1.wav`
    *   **Land:** `land1.wav`
    *   **Wall Hit:** `wall_hit1.wav`
    *   **Player Bump:** `player_bump1.wav`
    *   **Headbutt:** `headbutt1.wav`
    *   **Body Hit:** `body_hit1.wav`
    *   **Combo Sparkle:** `combo_sparkle1.wav` to `combo_sparkle4.wav`
    *   **Ball Bounce:** `ball_bounce1.wav`
    *   **Win Announcements:** `nils_wins.wav`, `harry_wins.wav`
    *   **Leading Announcements:** `nils_ahead.wav`, `harry_ahead.wav`
    *   **Misc Announcements:** `super_jackpot.wav`
    *   **Sword Hit:** `sword_hit.wav`
    *   **Crossbar Hit:** `crossbar_hit.wav`
    *   **Numbers (0-9):** `0.wav` to `9.wav` (likely for score/countdown)
    *   **Player Goal Announcements:** `player1_goal1.wav`, `player1_goal2.wav`, etc. (and for player 2)
    *   *(Commented out in reference code: Weather sounds like `sunny.wav`, `rainy.wav`, etc.)*

## Power-ups

17. **Spawn System:** Powerups spawn randomly, falling with parachutes.
18. **Types:** Various powerups affecting players or the ball. Managed via `active_powerups` dict (timer-based) on each player. Update logic likely decrements timers and removes effects.
    *   `FLIGHT`: Player can fly (`is_flying = True`), likely ignores gravity. Duration: `POWERUP_FLIGHT_DURATION`.
    *   `ROCKET_LAUNCHER`: (Based on reference2) Gives player 3 rockets (ammo) per pickup, stored in `active_powerups`. If active, `kick` action calls `fire_rocket` instead, consuming ammo and creating a `Rocket` object (managed in main game logic).
    *   `BIG_PLAYER`: Player becomes larger (scales dimensions via `calculate_current_sizes` using `POWERUP_BIG_PLAYER_SCALE`). Duration: `POWERUP_BIG_PLAYER_DURATION`. Cancels `SHRUNK`.
    *   `SUPER_JUMP`: Player jumps higher (multiplies `BASE_JUMP_POWER` by `POWERUP_SUPER_JUMP_MULTIPLIER`). Duration: `POWERUP_SUPER_JUMP_DURATION`.
    *   `BALL_FREEZE`: (Based on reference2) Adds duration to a global `ball_freeze_timer`. Sets `ball.is_frozen = True` and stops ball velocity. Managed in main game logic.
    *   `SPEED_BOOST`: Player becomes faster (multiplies `BASE_PLAYER_SPEED` by `POWERUP_SPEED_BOOST_MULTIPLIER`). Duration: `POWERUP_SPEED_BOOST_DURATION`.
    *   `GOAL_SHIELD`: (Based on reference2) Adds duration to player-specific global timers (`p1_shield_timer`/`p2_shield_timer`) and activates global flags (`pX_shield_active`). Managed in main game logic.
    *   `SHRINK_OPPONENT`: (Based on reference2) Calls a method on the opponent (`apply_shrink`) which sets `is_shrunk = True`, applies `POWERUP_SHRINK_PLAYER_DURATION`, cancels `BIG_PLAYER`/`ENORMOUS_HEAD`, and recalculates size.
    *   `LOW_GRAVITY`: (Based on reference2) Has a duration `POWERUP_LOW_GRAVITY_DURATION`. Reduces gravity effect (multiplies applied gravity by `POWERUP_LOW_GRAVITY_FACTOR`).
    *   `REVERSE_CONTROLS`: Reverses opponent's controls (sets flag on opponent via `apply_reverse_controls`, checked in input handling). Duration: `POWERUP_REVERSE_CONTROLS_DURATION`.
    *   `GOAL_ENLARGER`: (Based on reference2) Sets a global timer (`pX_goal_enlarged_timer`) for the *opponent's* goal for `POWERUP_GOAL_ENLARGER_DURATION`. Increases goal height. Managed in main game logic.
    *   `SWORD`: Gives player a sword (`is_sword = True`). Drawn from hand, angle animated with kick. Collides as a line. Duration: `POWERUP_SWORD_DURATION`.
    *   `ENORMOUS_HEAD`: Enlarges player's head (`POWERUP_ENORMOUS_HEAD_SCALE`). Duration: `POWERUP_ENORMOUS_HEAD_DURATION`. Combines with other size changes.

## Weather

19. **Random Weather:** Different types selected (Sunny, Rainy, Windy, Snowy, Foggy, Gothenburg Weather).
20. **Effects:**
    *   Physics: Changes gravity, adds wind force affecting players/ball.
    *   Visuals: Background color, rain/snow particles.
    *   Gameplay: Fog might reduce visibility.
21. **Weather Messages:** Displays the current weather condition.
22. **Performance Adaptation:** Option to disable weather effects on low FPS.

## Miscellaneous

23. **Game States:** Handles different phases using `current_game_state` variable:
    *   **`WELCOME`:** Initial state. Shows welcome screen. Waits for key press to transition to `PLAYING`.
    *   **`PLAYING`:** Main gameplay loop. Handles input, physics, rendering.
        *   **Goal Event:** On goal, triggers effects (sound, flash, particles), updates score, sets `goal_message_timer`. Positions likely reset.
        *   **Match End:** When score limit reached, sets `match_active = False`, starts `match_over_timer`. Displays final score.
        *   **Game End Check:** During match over, checks if game win limit is reached. If so, sets `game_over = True`.
    *   **`MATCH_OVER` (Implicit Period):** The duration while `match_over_timer > 0`.
    *   **`GAME_OVER`:** Entered when `match_over_timer` expires *and* `game_over` is true. Plays game over sound.
    *   **`TROPHY` (Visual within `GAME_OVER`):** Draws trophy screen with winner details. Waits for key press.
24. **Reset Functions:** 
    *   `reset_positions`: Resets player/ball positions (e.g., after goal).
    *   `start_new_match`: Resets scores, timers, powerups for a new match. Called when `match_over_timer` expires if `game_over` is false. Transitions state to `PLAYING`.
    *   `start_new_game`: Resets game wins, scores, etc. Called on key press in `GAME_OVER`. Transitions state to `PLAYING`.
25. **Debug Mode:** Option for displaying debug info and settings.
26. **Configuration:** Numerous constants for tweaking physics, animations, colors, timings, etc. 

## Controls

**Player 1:**
*   **Jump:** `W` (Press)
*   **Kick:** `S` (Press)
*   **Run Left:** `A` (Hold)
*   **Run Right:** `D` (Hold)

**Player 2:**
*   **Jump:** `Up Arrow` (Press)
*   **Kick:** `Down Arrow` (Press)
*   **Run Left:** `Left Arrow` (Hold)
*   **Run Right:** `Right Arrow` (Hold) 