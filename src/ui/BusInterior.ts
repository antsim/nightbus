import type * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { STR } from '../data/strings.fi';
import type { Rect } from './WindowScenery';

const WALL = 0x0d0d14;
const FRAME = 0x2b2b38;
const POLE = 0xd4a017;
const SEAT = 0x3b2f5c;
const SEAT_PATTERN = 0x4f3f7a;

/**
 * Bus interior drawn over the window: walls, window frames, glass,
 * yellow poles, seats, the ceiling stop display and the clock.
 */
export class BusInterior {
  readonly stopDisplay: Phaser.GameObjects.Text;
  readonly clock: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, window: Rect, pillarsX: readonly number[]) {
    const { x, y, width, height } = window;
    const bottom = y + height;

    // Glass: faint tint and a diagonal reflection band (the player's own reflection goes here later).
    const glass = scene.add.graphics();
    glass.fillStyle(0x9fb4ff, 0.04).fillRect(x, y, width, height);
    glass.fillStyle(0xffffff, 0.05).fillTriangle(x + 120, y, x + 260, y, x + 40, bottom);
    glass.fillStyle(0xffffff, 0.05).fillTriangle(x + 260, y, x + 40, bottom, x + 120, bottom);

    const g = scene.add.graphics();
    g.fillStyle(WALL, 1);
    g.fillRect(0, 0, GAME_WIDTH, y);
    g.fillRect(0, bottom, GAME_WIDTH, GAME_HEIGHT - bottom);
    g.fillRect(0, y, x, height);
    g.fillRect(x + width, y, GAME_WIDTH - x - width, height);

    g.lineStyle(6, FRAME, 1).strokeRect(x, y, width, height);
    for (const px of pillarsX) g.fillStyle(FRAME, 1).fillRect(px - 8, y, 16, height);

    // Seat backs in the row in front.
    const seatY = bottom + 60;
    for (let sx = 70; sx < GAME_WIDTH - 60; sx += 220) {
      g.fillStyle(SEAT, 1).fillRoundedRect(sx, seatY, 180, GAME_HEIGHT - seatY + 20, 18);
      g.fillStyle(SEAT_PATTERN, 1);
      for (let dx = 14; dx < 170; dx += 26) g.fillRect(sx + dx, seatY + 20, 8, 8);
      g.fillStyle(0x777788, 1).fillRect(sx + 20, seatY - 6, 140, 8);
    }

    // Yellow poles in front of the window pillars.
    for (const px of pillarsX) g.fillStyle(POLE, 1).fillRect(px - 5, 0, 10, GAME_HEIGHT);
    g.fillStyle(0x99999f, 1).fillRect(0, y - 14, GAME_WIDTH, 6);

    // Ceiling stop display.
    const displayW = 320;
    g.fillStyle(0x050505, 1).fillRect(GAME_WIDTH / 2 - displayW / 2, 8, displayW, 40);
    g.lineStyle(2, 0x333340, 1).strokeRect(GAME_WIDTH / 2 - displayW / 2, 8, displayW, 40);
    this.stopDisplay = scene.add
      .text(GAME_WIDTH / 2, 28, STR.bus.nextStopUnknown, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffb000',
      })
      .setOrigin(0.5);

    this.clock = scene.add
      .text(GAME_WIDTH - 16, 28, '', { fontFamily: 'monospace', fontSize: '22px', color: '#cfd8ff' })
      .setOrigin(1, 0.5);
  }
}
