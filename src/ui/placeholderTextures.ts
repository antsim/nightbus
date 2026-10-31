import type * as Phaser from 'phaser';
import { TextureKeys } from '../assets/manifest';
import { createRng, type Rng } from '../core/rng';

// Generated stand-ins for scenery art. A real image loaded under the same
// key in the manifest takes precedence.

type Painter = (g: Phaser.GameObjects.Graphics, rng: Rng) => void;

interface Placeholder {
  width: number;
  height: number;
  paint: Painter;
}

const PLACEHOLDER_SEED = 6;

function buildings(base: number, minH: number, maxH: number, windowColor: number, windowAlpha: number): Painter {
  return (g, rng) => {
    const { width, height } = g.getData('size') as { width: number; height: number };
    let x = 0;
    while (x < width) {
      const w = Math.min(rng.int(40, 90), width - x);
      const h = rng.int(minH, maxH);
      g.fillStyle(base, 1).fillRect(x, height - h, w - 3, h);
      for (let wy = height - h + 8; wy < height - 10; wy += 14) {
        for (let wx = x + 6; wx < x + w - 12; wx += 12) {
          if (rng.next() < 0.25) g.fillStyle(windowColor, windowAlpha).fillRect(wx, wy, 5, 7);
        }
      }
      x += w;
    }
  };
}

const streetLamp: Painter = (g) => {
  const { width, height } = g.getData('size') as { width: number; height: number };
  const ground = height - 34;
  const poleX = 60;
  // Light cone and pool on the pavement.
  g.fillStyle(0xffd27a, 0.13).fillTriangle(poleX + 18, 52, poleX - 50, ground, poleX + 90, ground);
  g.fillStyle(0xffd27a, 0.18).fillEllipse(poleX + 20, ground + 4, 160, 18);
  // Pavement and kerb.
  g.fillStyle(0x23232c, 1).fillRect(0, ground, width, height - ground);
  g.fillStyle(0x3a3a46, 1).fillRect(0, ground, width, 4);
  // Pole and lamp head.
  g.fillStyle(0x4a4a55, 1).fillRect(poleX, 46, 6, ground - 46);
  g.fillStyle(0x4a4a55, 1).fillRect(poleX, 46, 26, 5);
  g.fillStyle(0xfff0b0, 1).fillCircle(poleX + 22, 54, 5);
  g.fillStyle(0xffd27a, 0.25).fillCircle(poleX + 22, 54, 14);
};

const PLACEHOLDERS: Record<string, Placeholder> = {
  [TextureKeys.sceneryFar]: { width: 512, height: 120, paint: buildings(0x161a36, 40, 110, 0xffd166, 0.35) },
  [TextureKeys.sceneryMid]: { width: 640, height: 170, paint: buildings(0x1f2447, 70, 160, 0xffe29a, 0.6) },
  [TextureKeys.sceneryNear]: { width: 330, height: 260, paint: streetLamp },
};

export function ensurePlaceholderTextures(scene: Phaser.Scene): void {
  const rng = createRng(PLACEHOLDER_SEED);
  for (const [key, { width, height, paint }] of Object.entries(PLACEHOLDERS)) {
    if (scene.textures.exists(key)) continue;
    const g = scene.add.graphics();
    g.setData('size', { width, height });
    paint(g, rng);
    g.generateTexture(key, width, height);
    g.destroy();
  }
}
