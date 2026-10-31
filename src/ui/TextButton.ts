import * as Phaser from 'phaser';

export interface TextButtonStyle {
  width: number;
  height: number;
  fill: number;
  hoverFill: number;
  textColor: string;
  fontFamily: string;
  fontSize: number;
}

const DEFAULT_STYLE: TextButtonStyle = {
  width: 220,
  height: 52,
  fill: 0x2b2f5a,
  hoverFill: 0x3d4380,
  textColor: '#ffffff',
  fontFamily: 'sans-serif',
  fontSize: 20,
};

/** Rectangular button with a label; mouse and touch. */
export class TextButton {
  readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, style: Partial<TextButtonStyle> = {}) {
    const s = { ...DEFAULT_STYLE, ...style };
    this.bg = scene.add.rectangle(0, 0, s.width, s.height, s.fill).setStrokeStyle(2, 0xffffff, 0.25);
    this.label = scene.add
      .text(0, 0, text, { fontFamily: s.fontFamily, fontSize: `${s.fontSize}px`, color: s.textColor })
      .setOrigin(0.5);
    this.container = scene.add.container(x, y, [this.bg, this.label]);

    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.bg.setFillStyle(s.hoverFill));
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.bg.setFillStyle(s.fill));
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onClick);
  }

  setText(text: string): this {
    this.label.setText(text);
    return this;
  }
}
