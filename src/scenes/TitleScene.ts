import * as Phaser from 'phaser';
import { FONT_MONO, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { STR } from '../data/strings.fi';
import { loadBest } from '../services/bestScore';
import { TextButton } from '../ui/TextButton';
import { SceneKeys } from './keys';
import { startRun } from './session';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Title);
  }

  create(): void {
    const t = STR.title;
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 90, t.name, { fontFamily: FONT_MONO, fontSize: '52px', fontStyle: 'bold', color: '#ffd166' })
      .setOrigin(0.5);
    this.add
      .text(cx, 150, t.tagline, { fontFamily: 'sans-serif', fontSize: '20px', color: '#c8c8e0' })
      .setOrigin(0.5);
    this.add
      .text(cx, 240, [...t.howTo], {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5);

    new TextButton(this, cx, 360, t.start, () => startRun(this), { width: 260, height: 64, fontSize: 26, fill: 0xc81e1e, hoverFill: 0xe23a3a });

    const best = loadBest();
    this.add
      .text(cx, GAME_HEIGHT - 70, best ? t.best(best.score, STR.result.outcomes[best.outcome]) : t.noBest, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#9999bb',
      })
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown-SPACE', () => startRun(this));
    this.input.keyboard?.once('keydown-ENTER', () => startRun(this));
  }
}
