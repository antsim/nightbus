import * as Phaser from 'phaser';
import { DebugOverlay } from '../ui/DebugOverlay';
import { SceneKeys } from './keys';
import { getRoute, getSession } from './session';

/** Runs on top of the game scene so camera filters (blur, vignette) don't affect the debug text. */
export class DebugScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Debug);
  }

  create(): void {
    new DebugOverlay(this, getSession(this), getRoute(this));
  }
}
