import type * as Phaser from 'phaser';
import { FONT_MONO } from '../config';
import type { RunReport, ScoreItem } from '../core/report';
import { createRng } from '../core/rng';
import { STR } from '../data/strings.fi';

const COLS = 36;
const FONT_SIZE = 14;
const LINE_SPACING = 2;
const PAD = 18;
const PAPER = 0xf7f3e8;
const INK = '#2a2a2a';
const TEETH = 9;

const R = STR.result.receipt;

function row(left: string, right: string, width = COLS): string {
  const space = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(space) + right;
}

function center(text: string, width = COLS): string {
  return ' '.repeat(Math.max(0, Math.floor((width - text.length) / 2))) + text;
}

function wrap(text: string, width = COLS): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > width) {
      out.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(line);
  return out;
}

const dashes = '- '.repeat(COLS / 2).trimEnd();
const decimal = (n: number) => n.toFixed(1).replace('.', ',');

function scoreLabel(item: ScoreItem): string {
  const s = R.score;
  switch (item.kind) {
    case 'base':
      return s.base;
    case 'wrongStops':
      return s.wrongStops(item.count);
    case 'terminusFee':
      return s.terminusFee;
    case 'awake':
      return s.awake(item.minutes);
    case 'microsleeps':
      return s.microsleeps(item.count);
    case 'sickFee':
      return s.sickFee;
  }
}

/** Receipt text as lines; the total line is returned separately so it can be bold. */
export function receiptLines(report: RunReport, date: string): { top: string[]; total: string; bottom: string[] } {
  const top = [
    center(R.line(report.lineName, report.headsign)),
    row(R.receiptNo(report.receiptNo), date),
    R.seed(report.seed),
    dashes,
    row(`${R.boarded} ${report.boardedTime}`, report.boardedStopName),
    row(`${R.alighted} ${report.alightTime}`, report.alightStopName),
    row(R.outcome, STR.result.outcomes[report.outcome.kind]),
    row(
      R.microsleeps,
      report.microsleeps > 0
        ? `${report.microsleeps} (${R.longest(decimal(report.longestMicrosleepMin))})`
        : '0',
    ),
    row(R.stopsMissed, R.stopsUnit(report.stopsMissed)),
    row(R.longestShut, R.seconds(decimal(report.longestEyesShutSec))),
    dashes,
    ...report.scoreItems.map((item) => row(scoreLabel(item), String(item.points))),
    '='.repeat(COLS),
  ];
  const bottom = [
    '',
    ...report.lines.flatMap((l) => [...wrap(l), '']),
    ...(report.outcome.kind === 'home' ? [] : [...wrap(R.walkHome), '']),
  ];
  // Pad to full width so every block aligns to the same left edge.
  return { top, total: row(R.total, `${report.score} ${R.points}`), bottom: bottom.map((l) => l.padEnd(COLS)) };
}

/**
 * Receipt-style report on narrow paper. Everything is inside `container`,
 * and `bounds()` gives its screen rectangle for the PNG snapshot.
 */
export class ReceiptView {
  readonly container: Phaser.GameObjects.Container;
  private readonly width: number;
  private readonly height: number;

  constructor(scene: Phaser.Scene, x: number, top: number, report: RunReport, date: string, newRecord: boolean) {
    const style = { fontFamily: FONT_MONO, fontSize: `${FONT_SIZE}px`, color: INK, lineSpacing: LINE_SPACING };
    const { top: topLines, total, bottom } = receiptLines(report, date);

    const header = scene.add
      .text(0, PAD, R.header, { ...style, fontSize: `${FONT_SIZE + 6}px`, fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    const body = scene.add.text(0, header.y + header.height + 6, topLines, style).setOrigin(0.5, 0);
    const totalText = scene.add
      .text(0, body.y + body.height + 2, total, { ...style, fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    const tail = scene.add.text(0, totalText.y + totalText.height + 2, bottom, style).setOrigin(0.5, 0);

    this.width = body.width + PAD * 2;
    const barcodeY = tail.y + tail.height + 4;
    const barcodeH = 34;
    const thanks = scene.add
      .text(0, barcodeY + barcodeH + 8, R.thanks, { ...style, fontSize: `${FONT_SIZE - 2}px` })
      .setOrigin(0.5, 0);
    this.height = thanks.y + thanks.height + PAD + TEETH;

    const paper = scene.add.graphics();
    paper.fillStyle(PAPER, 1).fillRect(-this.width / 2, 0, this.width, this.height - TEETH);
    // Torn bottom edge.
    for (let tx = -this.width / 2; tx < this.width / 2; tx += TEETH * 2) {
      paper.fillTriangle(tx, this.height - TEETH, tx + TEETH * 2, this.height - TEETH, tx + TEETH, this.height);
    }

    const barcode = scene.add.graphics().fillStyle(0x1a1a1a, 1);
    const rng = createRng(report.seed);
    const barcodeW = this.width - PAD * 4;
    for (let bx = -barcodeW / 2; bx < barcodeW / 2; ) {
      const w = rng.int(1, 4);
      if (rng.next() < 0.6) barcode.fillRect(bx, barcodeY, w, barcodeH);
      bx += w + rng.int(1, 3);
    }

    const parts: Phaser.GameObjects.GameObject[] = [paper, header, body, totalText, tail, barcode, thanks];
    if (newRecord) {
      const stamp = scene.add
        .text(this.width / 2 - 80, tail.y + 4, R.newRecord, {
          fontFamily: FONT_MONO,
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#c81e1e',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5)
        .setAngle(-12)
        .setAlpha(0.85);
      parts.push(stamp);
    }
    this.container = scene.add.container(x, top, parts);
  }

  /** Scales the receipt down if it does not fit `maxHeight`. */
  fitHeight(maxHeight: number): this {
    this.container.setScale(Math.min(1, maxHeight / this.height));
    return this;
  }

  /** Screen rectangle covered by the receipt (for snapshots). */
  bounds(): { x: number; y: number; width: number; height: number } {
    const s = this.container.scale;
    return {
      x: Math.floor(this.container.x - (this.width / 2) * s),
      y: Math.floor(this.container.y),
      width: Math.ceil(this.width * s),
      height: Math.ceil(this.height * s),
    };
  }
}
