export class InputHandler {
    private keys: Set<string> = new Set();

    constructor() {
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.key.toLowerCase());
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key.toLowerCase());
        });
    }

    isKeyPressed(key: string): boolean {
        return this.keys.has(key.toLowerCase());
    }
} 