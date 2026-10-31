import * as Phaser from 'phaser';
import { ASSETS, type ImageAsset } from '../assets/manifest';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { GameSession } from '../core/session';
import { BALANCE } from '../data/balance';
import { STR } from '../data/strings.fi';
import { StaticRouteProvider, type RouteProvider } from '../services/routeProvider';
import { SceneKeys } from './keys';
import { seedFromUrl, setRoute, setSession } from './session';

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
    void this.startRun(new StaticRouteProvider());
  }

  private async startRun(provider: RouteProvider): Promise<void> {
    // MVP: fixed starting values from BALANCE.start; later the bar phase sets them.
    const routeId = BALANCE.start.routeId;
    try {
      setRoute(this, await provider.getRoute(routeId));
    } catch (err) {
      console.error(err);
      this.children.removeAll();
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, STR.boot.routeError, { fontSize: '24px', color: '#ff6b6b' })
        .setOrigin(0.5);
      return;
    }
    setSession(this, GameSession.start({ seed: seedFromUrl(), routeId }));
    this.scene.start(SceneKeys.Bus);
  }
}
