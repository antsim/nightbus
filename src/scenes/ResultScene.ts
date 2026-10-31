import * as Phaser from 'phaser';
import { GAME_HEIGHT } from '../config';
import { buildReport, type RunReport } from '../core/report';
import { STR } from '../data/strings.fi';
import { loadBest, saveIfBest } from '../services/bestScore';
import { saveImage } from '../services/shareImage';
import { ReceiptView } from '../ui/ReceiptView';
import { TextButton } from '../ui/TextButton';
import { SceneKeys } from './keys';
import { getRoute, getSession, startRun } from './session';

const RECEIPT_X = 330;
const MARGIN = 10;
const BUTTONS_X = 740;
const KEY_DELAY_MS = 1200;

/** Receipt-style end-of-run report with retry, save-as-image and menu. */
export class ResultScene extends Phaser.Scene {
  private report!: RunReport;
  private receipt!: ReceiptView;

  constructor() {
    super(SceneKeys.Result);
  }

  create(): void {
    const now = new Date();
    this.report = buildReport(getSession(this).state, getRoute(this));
    const newRecord = saveIfBest(this.report, now);
    const best = loadBest();

    this.receipt = new ReceiptView(this, RECEIPT_X, MARGIN, this.report, now.toLocaleDateString('fi-FI'), newRecord);
    this.receipt.fitHeight(GAME_HEIGHT - MARGIN * 2);

    if (best) {
      this.add
        .text(BUTTONS_X, 150, STR.result.best(best.score), { fontFamily: 'sans-serif', fontSize: '18px', color: '#c8c8e0' })
        .setOrigin(0.5);
    }
    new TextButton(this, BUTTONS_X, 220, STR.result.again, () => startRun(this));
    const save = new TextButton(this, BUTTONS_X, 290, STR.result.save, () => this.saveImage(save));
    new TextButton(this, BUTTONS_X, 360, STR.result.menu, () => this.scene.start(SceneKeys.Title));

    // Keys only after a moment, so space still being mashed from the bus doesn't skip the receipt.
    this.time.delayedCall(KEY_DELAY_MS, () => {
      this.input.keyboard?.once('keydown-SPACE', () => startRun(this));
      this.input.keyboard?.once('keydown-ENTER', () => startRun(this));
    });
  }

  /** PNG of the receipt area only. */
  private saveImage(button: TextButton): void {
    const { x, y, width, height } = this.receipt.bounds();
    this.game.renderer.snapshotArea(x, y, width, height, (snapshot) => {
      if (!(snapshot instanceof HTMLImageElement)) return;
      void saveImage(snapshot.src, `yobussi-kuitti-${this.report.seed}.png`, STR.result.shareTitle).then(() => {
        button.setText(STR.result.saved);
        this.time.delayedCall(2000, () => button.setText(STR.result.save));
      });
    });
  }
}
