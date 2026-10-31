import type * as Phaser from 'phaser';

export interface MeterBarStyle {
  width: number;
  height: number;
  lowColor: number;
  highColor: number;
}

function mix(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return m(16) | m(8) | m(0);
}

/** Small labelled bar, e.g. the fatigue meter. */
export class MeterBar {
  private readonly bar: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    label: string,
    private readonly style: MeterBarStyle,
    depth: number,
  ) {
    scene.add
      .text(x, y, label, { fontFamily: 'sans-serif', fontSize: '13px', color: '#c8c8e0' })
      .setOrigin(1, 0.5)
      .setAlpha(0.8)
      .setDepth(depth);
    this.bar = scene.add.graphics().setDepth(depth);
  }

  set(value: number): void {
    const { width, height, lowColor, highColor } = this.style;
    const x = this.x + 8;
    const y = this.y - height / 2;
    this.bar
      .clear()
      .fillStyle(0x000000, 0.5)
      .fillRect(x, y, width, height)
      .fillStyle(mix(lowColor, highColor, value), 0.9)
      .fillRect(x, y, width * value, height);
  }
}
