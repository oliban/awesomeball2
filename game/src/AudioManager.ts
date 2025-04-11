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

  constructor() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('AudioContext created successfully.');
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
      console.log('Sounds already loading...');
      return this.loadingPromise;
    }
    if (this.soundsLoaded) {
      console.log('Sounds already loaded.');
      return Promise.resolve();
    }

    console.log('Loading sounds...');
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
        console.log('All sounds loaded successfully.');
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
   * Optional: Add methods for stopping sounds, managing sound queues, etc.
   */
}

// Create a singleton instance
export const audioManager = new AudioManager(); 