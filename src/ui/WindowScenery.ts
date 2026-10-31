import type * as Phaser from 'phaser';
import { TextureKeys } from '../assets/manifest';
import type { Landmark, Route } from '../core/route';
import { BALANCE } from '../data/balance';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LandmarkView {
  landmark: Landmark;
  factor: number;
  object: Phaser.GameObjects.Container;
}

const LANDMARK_COLORS = [0x6b8cff, 0xff8c6b, 0x7bd389, 0xd38bd3, 0xf2c14e, 0x5ed1d1];

/** Stable colour per landmark id (placeholder art only). */
function colorFor(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LANDMARK_COLORS[h % LANDMARK_COLORS.length] ?? 0xffffff;
}

/**
 * Night scenery behind the bus window. Everything is positioned directly
 * from the route offset, so it stays in sync with the logic and speeds up
 * with the game clock (F2) automatically.
 */
export class WindowScenery {
  private readonly far: Phaser.GameObjects.TileSprite;
  private readonly mid: Phaser.GameObjects.TileSprite;
  private readonly near: Phaser.GameObjects.TileSprite;
  private readonly landmarks: LandmarkView[] = [];
  private readonly centerX: number;

  constructor(scene: Phaser.Scene, route: Route, private readonly area: Rect) {
    const { x, y, width, height } = area;
    const bottom = y + height;
    this.centerX = x + width / 2;

    scene.add
      .graphics()
      .fillGradientStyle(0x05061a, 0x05061a, 0x2a1f4a, 0x2a1f4a, 1).fillRect(x, y, width, height);

    const tex = (key: string) => scene.textures.get(key).getSourceImage();
    const farH = tex(TextureKeys.sceneryFar).height;
    const midH = tex(TextureKeys.sceneryMid).height;
    this.far = scene.add.tileSprite(x, bottom - 30 - farH, width, farH, TextureKeys.sceneryFar).setOrigin(0);
    this.mid = scene.add.tileSprite(x, bottom - 24 - midH, width, midH, TextureKeys.sceneryMid).setOrigin(0);

    // Far-side landmarks sit between the mid and near layers; near-side ones in front.
    const farSide = route.landmarks.filter((l) => l.side === 'left');
    const nearSide = route.landmarks.filter((l) => l.side === 'right');
    for (const lm of farSide) this.addLandmark(scene, lm, BALANCE.scenery.farSideFactor, bottom - 34, 0.65);

    this.near = scene.add.tileSprite(x, y, width, height, TextureKeys.sceneryNear).setOrigin(0);
    for (const lm of nearSide) this.addLandmark(scene, lm, BALANCE.scenery.layerFactors.near, bottom - 20, 1);
    // No mask needed: BusInterior is drawn on top and covers everything outside the window.
    // (Phaser 4 geometry masks are Canvas-only; WebGL would need a Mask filter.)
  }

  private addLandmark(scene: Phaser.Scene, landmark: Landmark, factor: number, groundY: number, scale: number): void {
    const w = 150 * scale;
    const h = 120 * scale;
    const container = scene.add.container(0, groundY);
    if (scene.textures.exists(landmark.sprite)) {
      container.add(scene.add.image(0, 0, landmark.sprite).setOrigin(0.5, 1));
    } else {
      const color = colorFor(landmark.id);
      container.add(scene.add.rectangle(0, 0, w, h, color, 0.85).setOrigin(0.5, 1).setStrokeStyle(2, 0xffffff, 0.6));
      container.add(
        scene.add
          .text(0, -h / 2, landmark.name, {
            fontFamily: 'sans-serif',
            fontSize: `${Math.round(16 * scale)}px`,
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: w - 10 },
          })
          .setOrigin(0.5),
      );
    }
    container.setAlpha(scale < 1 ? 0.8 : 1).setVisible(false);
    this.landmarks.push({ landmark, factor, object: container });
  }

  /** Call every frame with the (interpolated) route offset. */
  update(offsetSec: number): void {
    const px = offsetSec * BALANCE.scenery.pxPerRouteSec;
    const f = BALANCE.scenery.layerFactors;
    this.far.tilePositionX = px * f.far;
    this.mid.tilePositionX = px * f.mid;
    this.near.tilePositionX = px * f.near;

    const margin = 200;
    for (const view of this.landmarks) {
      // At atOffsetSec the landmark is centred in the window; before that it is to the right.
      const x = this.centerX + (view.landmark.atOffsetSec - offsetSec) * BALANCE.scenery.pxPerRouteSec * view.factor;
      const visible = x > this.area.x - margin && x < this.area.x + this.area.width + margin;
      view.object.setVisible(visible);
      if (visible) view.object.x = x;
    }
  }
}
