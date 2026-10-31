import type * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

const ARC_DEPTH = 70;
const SOFT_EDGE = 16;
const SEGMENTS = 32;
/** Overlap past the middle so the lids meet without a gap. */
const OVERLAP = 12;

/**
 * Upper and lower eyelids covering the screen. Position comes straight from
 * the core eyelid value every frame (no tweens).
 */
export class Eyelids {
  private readonly g: Phaser.GameObjects.Graphics;
  private last = -1;

  constructor(scene: Phaser.Scene, depth: number) {
    this.g = scene.add.graphics().setDepth(depth);
  }

  /** 0 = open, 1 = closed. */
  set(eyelid: number): void {
    const v = Math.round(eyelid * 1000) / 1000;
    if (v === this.last) return;
    this.last = v;
    const g = this.g.clear();
    if (v <= 0) return;

    // The lower lid moves less until the eyes are nearly shut.
    this.drawLid(g, v, 1);
    this.drawLid(g, Math.pow(v, 1.8), -1);
  }

  /** dir 1 = upper lid (from the top), -1 = lower lid (from the bottom). */
  private drawLid(g: Phaser.GameObjects.Graphics, v: number, dir: 1 | -1): void {
    const half = GAME_HEIGHT / 2;
    const base = -ARC_DEPTH + (half + OVERLAP + ARC_DEPTH) * v;
    const edge = (x: number, extra: number) => {
      const u = (x / GAME_WIDTH) * 2 - 1;
      const y = base + ARC_DEPTH * (1 - u * u) * (1 - v * 0.6) + extra;
      return dir === 1 ? y : GAME_HEIGHT - y;
    };
    const outer = dir === 1 ? -10 : GAME_HEIGHT + 10;

    for (const [extra, alpha] of [
      [SOFT_EDGE, 0.45],
      [0, 1],
    ] as const) {
      const points: Phaser.Types.Math.Vector2Like[] = [
        { x: 0, y: outer },
        { x: GAME_WIDTH, y: outer },
      ];
      for (let i = SEGMENTS; i >= 0; i--) {
        const x = (GAME_WIDTH * i) / SEGMENTS;
        points.push({ x, y: edge(x, extra) });
      }
      // fillPoints only reads x and y.
      g.fillStyle(0x000000, alpha).fillPoints(points as Phaser.Math.Vector2[], true);
    }
  }
}
