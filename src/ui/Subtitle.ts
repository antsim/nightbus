import type * as Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

/** Subtitle line for announcements and short notices. */
export class Subtitle {
  private readonly text: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    y: number,
    depth: number,
  ) {
    this.text = scene.add
      .text(GAME_WIDTH / 2, y, '', {
        fontFamily: 'sans-serif',
        fontSize: '24px',
        color: '#fff7d6',
        backgroundColor: '#000000b0',
        padding: { x: 14, y: 8 },
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 200 },
      })
      .setOrigin(0.5)
      .setDepth(depth)
      .setAlpha(0);
  }

  /** Shows `message` for `ms` (or until replaced); 0 keeps it visible. */
  show(message: string, ms: number): void {
    this.scene.tweens.killTweensOf(this.text);
    this.text.setText(message).setAlpha(1);
    if (ms > 0) this.scene.tweens.add({ targets: this.text, alpha: 0, delay: ms, duration: 400 });
  }
}
