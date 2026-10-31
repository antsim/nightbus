import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-700.css';
import * as Phaser from 'phaser';
import { BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH, PIXEL_ART } from './config';
import { SCENES } from './scenes';
import { initInstall } from './services/install';
import { initLifecycle } from './services/lifecycle';
import { initPwa } from './services/pwa';

initPwa();
initInstall();
initLifecycle();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: BACKGROUND_COLOR,
  pixelArt: PIXEL_ART,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: SCENES,
});

// Dev builds expose the game for inspection from the browser console.
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
