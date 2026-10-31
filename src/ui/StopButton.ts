import * as Phaser from 'phaser';
import { STR } from '../data/strings.fi';

/** Big red stop button. Works with mouse and touch; keys are wired by the scene. */
export class StopButton {
  readonly hitArea: Phaser.GameObjects.Arc;
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number, radius: number, depth: number, onPress: () => void) {
    this.glow = scene.add.circle(0, 0, radius + 10, 0xff3b3b, 0);
    const ring = scene.add.circle(0, 0, radius + 4, 0x2a2a35).setStrokeStyle(3, 0x55556a);
    this.hitArea = scene.add.circle(0, 0, radius, 0xc81e1e).setStrokeStyle(4, 0xff6b6b);
    const label = scene.add
      .text(0, 0, STR.bus.stopButton, { fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    this.container = scene.add.container(x, y, [this.glow, ring, this.hitArea, label]).setDepth(depth);

    this.hitArea.setInteractive({ useHandCursor: true });
    this.hitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.press(scene);
      onPress();
    });
  }

  /** Visual press feedback (also used for keyboard presses). */
  press(scene: Phaser.Scene): void {
    scene.tweens.killTweensOf(this.container);
    this.container.setScale(0.9);
    scene.tweens.add({ targets: this.container, scale: 1, duration: 150 });
  }

  setLit(on: boolean): void {
    this.glow.setFillStyle(0xff3b3b, on ? 0.35 : 0);
  }
}
