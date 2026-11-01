import type * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

const ARC_DEPTH = 70;
const SOFT_EDGE = 16;
const SEGMENTS = 32;
/** Overlap past the middle so the lids meet without a gap. */
const OVERLAP = 12;
/**
 * The lower lid moves less until the eyes are nearly shut. Tuned so that at
 * eyelid 0.5 (where pressing starts to help) both lids cover about a quarter.
 */
const LOWER_LID_CURVE = 1.2;
/** Lids extend this far past the screen edges, so a swaying camera never shows a gap. */
export const OVERSCAN = 60;
/** Flutter oscillations per second. */
const FLUTTER_HZ = 18;

/**
 * Upper and lower eyelids covering the screen. Position comes straight from
 * the core eyelid value every frame (no tweens).
 */
export class Eyelids {
  private readonly g: Phaser.GameObjects.Graphics;
  private last = -1;
  /** Current flutter amplitude in eyelid units; tweened down to 0. */
  private flutterAmp = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    depth: number,
  ) {
    this.g = scene.add.graphics().setDepth(depth);
  }

  /** A brief quiver of the lids (e.g. startle). */
  flutter(amount: number, durationMs: number): void {
    this.scene.tweens.killTweensOf(this);
    this.flutterAmp = amount;
    this.scene.tweens.add({ targets: this, flutterAmp: 0, duration: durationMs, ease: 'Quad.easeOut' });
  }

  /** 0 = open, 1 = closed. */
  set(eyelid: number): void {
    const quiver = this.flutterAmp * Math.sin((this.scene.time.now / 1000) * FLUTTER_HZ * Math.PI * 2);
    const v = Math.round(Math.min(1, Math.max(0, eyelid + quiver)) * 1000) / 1000;
    if (v === this.last) return;
    this.last = v;
    const g = this.g.clear();
    if (v <= 0) return;

    this.drawLid(g, v, 1);
    this.drawLid(g, Math.pow(v, LOWER_LID_CURVE), -1);
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
    const outer = dir === 1 ? -OVERSCAN : GAME_HEIGHT + OVERSCAN;

    for (const [extra, alpha] of [
      [SOFT_EDGE, 0.45],
      [0, 1],
    ] as const) {
      const points: Phaser.Types.Math.Vector2Like[] = [
        { x: -OVERSCAN, y: outer },
        { x: GAME_WIDTH + OVERSCAN, y: outer },
      ];
      for (let i = SEGMENTS; i >= 0; i--) {
        const x = -OVERSCAN + ((GAME_WIDTH + OVERSCAN * 2) * i) / SEGMENTS;
        points.push({ x, y: edge(x, extra) });
      }
      // fillPoints only reads x and y.
      g.fillStyle(0x000000, alpha).fillPoints(points as Phaser.Math.Vector2[], true);
    }
  }
}
