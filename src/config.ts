// Fixed logical resolution (16:9). Everything is laid out in these coordinates
// and Phaser's FIT scale mode handles the actual screen size.
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

// Set to true if the art style ends up being pixel art (disables smoothing).
export const PIXEL_ART = false;

export const BACKGROUND_COLOR = '#0b0d1a';

/** Bundled with @fontsource (works offline); loaded before the first scene draws text with it. */
export const FONT_MONO = '"IBM Plex Mono", monospace';
export const FONT_MONO_FACES = ['400 16px "IBM Plex Mono"', '700 16px "IBM Plex Mono"'];
