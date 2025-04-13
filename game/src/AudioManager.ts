import { ASSETS } from './Constants';

// Type definition for the structure of sound assets
interface SoundAssets {
  [key: string]: string;
}

// Type definition for the structure mapping sound keys to AudioBuffers
interface SoundBuffers {
  [key: string]: AudioBuffer | null;
}

/**
 * Manages loading and playing audio assets using the Web Audio API.
 */
export class AudioManager {
  private audioContext: AudioContext;
  private soundBuffers: SoundBuffers = {};
  private soundsLoaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;
  private activeLoops: Map<string, AudioBufferSourceNode> = new Map(); // To track looped sounds
  private soundFiles: { [key: string]: string } = {
    'KICK_1': 'sounds/kick1.wav',
    'KICK_2': 'sounds/kick2.wav',
    'KICK_3': 'sounds/kick3.wav',
    'JUMP_1': 'sounds/jump1.wav',
    'LAND_1': 'sounds/land1.wav',
    'LAND_2': 'sounds/land2.wav',
    'GOAL_1': 'sounds/goal1.wav',
    // Missing Rocket Sounds
    // 'ROCKET_FIRE_1': 'sounds/rocket_fire1.wav',
    // 'ROCKET_EXPLODE_1': 'sounds/rocket_explode1.wav',
  };

  constructor() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.error('Web Audio API is not supported in this browser.', e);
      // Provide a fallback or disable audio features
      this.audioContext = null as any; // Assign null and cast to bypass type checking
    }
  }

  /**
   * Loads all sound assets defined in Constants.ASSETS.SOUNDS.
   * Returns a promise that resolves when all sounds are loaded.
   */
  async loadSounds(): Promise<void> {
    if (!this.audioContext) {
      console.warn('AudioContext not available, skipping sound loading.');
      this.soundsLoaded = true; // Mark as loaded to prevent repeated attempts
      return Promise.resolve();
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }
    if (this.soundsLoaded) {
      return Promise.resolve();
    }

    const soundAssets = ASSETS.SOUNDS as SoundAssets;
    const loadPromises: Promise<void>[] = [];

    this.loadingPromise = new Promise(async (resolve, reject) => {
      for (const key in soundAssets) {
        if (Object.prototype.hasOwnProperty.call(soundAssets, key)) {
          const path = soundAssets[key];
          loadPromises.push(this.loadSound(key, path));
        }
      }

      try {
        await Promise.all(loadPromises);
        this.soundsLoaded = true;
        this.loadingPromise = null; // Reset loading promise
        resolve();
      } catch (error) {
        console.error('Error loading one or more sounds:', error);
        this.loadingPromise = null; // Reset loading promise
        reject(error); // Propagate the error
      }
    });

    return this.loadingPromise;
  }

  /**
   * Loads a single sound file.
   * @param key - The key to store the sound buffer under.
   * @param path - The path to the sound file.
   */
  private async loadSound(key: string, path: string): Promise<void> {
     if (!this.audioContext) return Promise.resolve(); // Skip if no context

    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} for ${path}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.soundBuffers[key] = audioBuffer;
      // console.log(`Sound loaded: ${key}`); // Optional: log individual loads
    } catch (error) {
      console.error(`Failed to load sound: ${key} from ${path}`, error);
      this.soundBuffers[key] = null; // Store null to indicate loading failure
      // Optionally re-throw or handle specific errors
    }
  }

  /**
   * Plays a loaded sound.
   * @param key - The key of the sound to play.
   * @param volume - Optional volume level (0 to 1). Defaults to 1.
   * @param loop - Optional flag to loop the sound. Defaults to false.
   */
  playSound(key: string, volume: number = 1, loop: boolean = false): void {
    if (!this.audioContext || !this.soundsLoaded) {
      // console.warn(`Cannot play sound '${key}': Audio system not ready or sound not loaded.`);
      return;
    }

    const buffer = this.soundBuffers[key];
    if (!buffer) {
      console.warn(`Sound buffer not found for key: ${key}`);
      return;
    }

    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.loop = loop;
      source.start(0);
      // console.log(`Playing sound: ${key}`); // Optional: log playback

      // If looping, store the source node so we can stop it later
      if (loop) {
        // Stop and remove any existing loop with the same key
        if (this.activeLoops.has(key)) {
          try {
             this.activeLoops.get(key)?.stop();
          } catch (e) {
             // Ignore errors if stop is called on an already stopped node
          }
        }
        this.activeLoops.set(key, source);
        // Remove from map when the sound naturally ends (though loop=true prevents this unless stopped)
        source.onended = () => {
          if (this.activeLoops.get(key) === source) { // Ensure it's the same node
              this.activeLoops.delete(key);
          }
        };
      }

    } catch (error) {
        console.error(`Error playing sound ${key}:`, error);
    }
  }

  /**
   * Checks if all sounds have been loaded.
   */
  areSoundsLoaded(): boolean {
    return this.soundsLoaded;
  }

  /**
   * Stops a specific looped sound if it is currently playing.
   * @param key The key of the looped sound to stop.
   */
  stopSound(key: string): void {
    if (this.activeLoops.has(key)) {
      const source = this.activeLoops.get(key);
      try {
        source?.stop(); // Stop playback
        console.log(`Stopped looped sound: ${key}`);
      } catch (e) {
        // Ignore errors, e.g., if stop is called after it already finished or was stopped
        // console.warn(`Could not stop sound ${key}:`, e);
      }
      this.activeLoops.delete(key); // Remove from active loops map
    }
  }
}

// Create a singleton instance
export const audioManager = new AudioManager(); 