import * as Phaser from 'phaser';
import { ASSETS, type ImageAsset } from '../assets/manifest';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { STR } from '../data/strings.fi';
import { SceneKeys } from './keys';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  preload(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, STR.boot.loading, { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);

    this.load.setPath(import.meta.env.BASE_URL);
    for (const asset of Object.values(ASSETS) as ImageAsset[]) {
      this.load.image(asset.key, asset.url);
    }
  }

  create(): void {
    this.scene.start(SceneKeys.Bus);
  }
}
