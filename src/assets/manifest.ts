// Scenes reference assets only by key. Swapping placeholder art for real
// files only requires adding entries here with the same keys.
export interface FileAsset {
  readonly key: string;
  /** Path relative to `public/`. */
  readonly url: string;
}

/** Image files loaded at boot. */
export const ASSETS = {} as const satisfies Record<string, FileAsset>;

/** Audio files loaded at boot. Add e.g. `engine: { key: SoundKeys.engine, url: 'audio/engine.ogg' }`. */
export const AUDIO = {} as const satisfies Record<string, FileAsset>;

/**
 * Texture keys the game draws with. Any key without a loaded image gets a
 * generated placeholder (see ui/placeholderTextures.ts).
 */
export const TextureKeys = {
  sceneryFar: 'scenery-far',
  sceneryMid: 'scenery-mid',
  sceneryNear: 'scenery-near',
} as const;

/** Sound keys. Sounds without a file are silently skipped. */
export const SoundKeys = {
  engine: 'sfx-engine',
} as const;
