import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { STR } from '../data/strings.fi';
import { SceneKeys } from './keys';

export class BusScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Bus);
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, STR.bus.arriving, { fontSize: '32px', color: '#ffd166' })
      .setOrigin(0.5);
  }
}
