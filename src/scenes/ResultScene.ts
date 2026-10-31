import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { formatTime } from '../core/clock';
import type { Outcome } from '../core/outcome';
import { STR } from '../data/strings.fi';
import { SceneKeys } from './keys';
import { getSession } from './session';

function detail(outcome: Outcome): string {
  const d = STR.result.detail;
  switch (outcome.kind) {
    case 'home':
      return d.home;
    case 'tooEarly':
      return d.tooEarly(outcome.stops);
    case 'overshot':
      return d.overshot(outcome.stops);
    case 'terminus':
      return d.terminus(outcome.stops);
  }
}

/** Minimal result screen; the receipt-style report comes in T07. */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Result);
  }

  create(): void {
    const s = getSession(this).state;
    const outcome = s.outcome;
    const lines = outcome ? [STR.result.titles[outcome.kind], detail(outcome)] : [];
    if (s.alight) lines.push(STR.result.alightedAt(s.alight.stopName, formatTime(s.alight.timeMin)));

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, lines, {
        fontFamily: 'sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 12,
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 60, STR.result.again, { fontFamily: 'sans-serif', fontSize: '18px', color: '#9999bb' })
      .setOrigin(0.5);

    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.scene.start(SceneKeys.Boot));
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start(SceneKeys.Boot));
  }
}
