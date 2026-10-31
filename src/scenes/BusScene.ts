import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { GameSession } from '../core/session';
import { STR } from '../data/strings.fi';
import { DebugOverlay } from '../ui/DebugOverlay';
import { SceneKeys } from './keys';
import { getSession } from './session';

export class BusScene extends Phaser.Scene {
  private session!: GameSession;

  constructor() {
    super(SceneKeys.Bus);
  }

  create(): void {
    this.session = getSession(this);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, STR.bus.arriving, { fontSize: '32px', color: '#ffd166' })
      .setOrigin(0.5);

    new DebugOverlay(this, this.session);
  }

  override update(_time: number, delta: number): void {
    this.session.tick(delta);
  }
}
