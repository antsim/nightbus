import * as Phaser from 'phaser';
import { ASSETS, AUDIO, type FileAsset } from '../assets/manifest';
import { FONT_MONO_FACES, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Route } from '../core/route';
import { BALANCE } from '../data/balance';
import { STR } from '../data/strings.fi';
import { StaticRouteProvider, type RouteProvider } from '../services/routeProvider';
import { ensurePlaceholderTextures } from '../ui/placeholderTextures';
import { SceneKeys } from './keys';
import { setRoute } from './session';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  preload(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, STR.boot.loading, { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);

    this.load.setPath(import.meta.env.BASE_URL);
    for (const asset of Object.values(ASSETS) as FileAsset[]) this.load.image(asset.key, asset.url);
    for (const asset of Object.values(AUDIO) as FileAsset[]) this.load.audio(asset.key, asset.url);
  }

  create(): void {
    ensurePlaceholderTextures(this);
    void this.prepare(new StaticRouteProvider());
  }

  private async prepare(provider: RouteProvider): Promise<void> {
    await loadFonts();
    const routeId = BALANCE.start.routeId;
    let route: Route;
    try {
      route = await provider.getRoute(routeId);
    } catch (err) {
      console.error(err);
      this.children.removeAll();
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, STR.boot.routeError, { fontSize: '24px', color: '#ff6b6b' })
        .setOrigin(0.5);
      return;
    }
    setRoute(this, route);
    this.scene.start(SceneKeys.Title);
  }
}

/** Wait for bundled fonts so the first draw doesn't use a fallback. Never blocks the game on failure. */
async function loadFonts(): Promise<void> {
  try {
    await Promise.all(FONT_MONO_FACES.map((face) => document.fonts.load(face)));
  } catch (err) {
    console.warn('Font loading failed', err);
  }
}
