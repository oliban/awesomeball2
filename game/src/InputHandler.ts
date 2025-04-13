export class InputHandler {
    private keys: Set<string> = new Set();
    private justPressedKeys: Set<string> = new Set(); // Track keys pressed this frame
    private previouslyPressedKeys: Set<string> = new Set(); // Track keys from last frame
    private justReleasedKeys: Set<string> = new Set(); // Track keys released this frame
    private previouslyReleasedKeys: Set<string> = new Set(); // Track keys from last frame

    constructor() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (!this.keys.has(key)) { // Only add to justPressed if it wasn't already down
                 this.justPressedKeys.add(key);
            }
            this.keys.add(key);
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys.delete(key);
            this.justReleasedKeys.add(key); // Track released keys
            // No need to explicitly track released keys for this use case yet
        });
    }

    // Called once per game loop update to manage just-pressed/released state
    update(): void {
        this.previouslyPressedKeys = new Set(this.justPressedKeys);
        this.justPressedKeys.clear();
        this.previouslyReleasedKeys = new Set(this.justReleasedKeys);
        this.justReleasedKeys.clear();
    }

    isKeyPressed(key: string): boolean {
        return this.keys.has(key.toLowerCase());
    }

    // Checks if the key was pressed down *this specific update cycle*
    wasKeyJustPressed(key: string): boolean {
        return this.previouslyPressedKeys.has(key.toLowerCase());
    }

    // Checks if the key was released *this specific update cycle*
    wasKeyJustReleased(key: string): boolean {
        return this.previouslyReleasedKeys.has(key.toLowerCase());
    }
} 