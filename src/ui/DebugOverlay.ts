import * as Phaser from 'phaser';
import { formatTime } from '../core/clock';
import { isFlustered } from '../core/drowsiness';
import { METER_IDS } from '../core/meters';
import { formatEuros } from '../core/money';
import { homeStop, nextStop, type Route } from '../core/route';
import type { GameSession } from '../core/session';
import { BALANCE } from '../data/balance';
import { STR } from '../data/strings.fi';

const BAR_WIDTH = 20;

// Survives scene changes so the overlay stays open when moving between scenes.
let visible = false;

function bar(value: number): string {
  const filled = Math.round(value * BAR_WIDTH);
  return `[${'#'.repeat(filled)}${'.'.repeat(BAR_WIDTH - filled)}] ${value.toFixed(3)}`;
}

/** F1 toggles a text overlay with meters and clock; F2 toggles fast-forward; F3 maxes fatigue. */
export class DebugOverlay {
  private readonly text: Phaser.GameObjects.Text;
  private fast = false;

  constructor(
    scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly route?: Route,
  ) {
    this.text = scene.add
      .text(8, 8, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#7CFC00',
        backgroundColor: '#000000cc',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(10_000)
      .setVisible(visible);

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F1, true).on('down', () => this.toggle());
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F2, true).on('down', () => this.toggleFast());
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3, true).on('down', () => this.session.setMeter('fatigue', 1));
    }

    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.refresh, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.refresh, this);
    });
  }

  private toggle(): void {
    visible = !visible;
    this.text.setVisible(visible);
    this.refresh();
  }

  private toggleFast(): void {
    this.fast = !this.fast;
    const multiplier = this.fast ? BALANCE.time.debugSpeedMultiplier : 1;
    this.session.setTimeScale(BALANCE.time.timeScale * multiplier);
  }

  private refresh(): void {
    if (!visible) return;
    const s = this.session.state;
    const d = STR.debug;
    const mods = s.modifiers.map(
      (m) =>
        `  ${m.id} → ${m.meter} ${m.ratePerMin >= 0 ? '+' : ''}${m.ratePerMin}/min ` +
        `(${m.remainingMin === null ? d.permanent : `${m.remainingMin.toFixed(1)} min`})`,
    );

    this.text.setText([
      d.title,
      `${d.clock}: ${formatTime(s.clock.minutes)}`,
      `${d.timeScale}: ${s.clock.timeScale} ${d.timeScaleUnit}${this.fast ? ' (×' + BALANCE.time.debugSpeedMultiplier + ')' : ''}`,
      `${d.seed}: ${s.seed}`,
      ...METER_IDS.map((id) => `${d[id].padEnd(8)} ${bar(s.meters[id].value)}`),
      `${d.money}: ${formatEuros(s.money)}`,
      `${d.modifiers}:${mods.length === 0 ? ' ' + d.none : ''}`,
      ...mods,
      ...this.eyeLines(),
      `${d.logEntries}: ${s.log.length}`,
      ...this.routeLines(),
    ]);
  }

  private eyeLines(): string[] {
    const s = this.session.state;
    const e = s.drowsiness;
    const d = STR.debug;
    const flags = [e.phase === 'asleep' ? d.asleep : '', e.confusedMs > 0 ? d.confused : ''].filter(Boolean).join(', ');
    const wave = e.wave ? ` (${e.wave.depth.toFixed(2)} ${(e.wave.elapsedSec / e.wave.durationSec * 100).toFixed(0)}%)` : '';
    const since =
      e.lastMicrosleepAtMin === null ? d.none : `${(s.clock.minutes - e.lastMicrosleepAtMin).toFixed(1)} min`;
    const press = e.lastPress === null ? d.none : d.pressEffects[e.lastPress];
    const flustered = isFlustered(e) ? ` ${d.flustered}` : '';
    return [
      `${d.eyes.padEnd(8)} ${bar(e.eyelid)} ${d.waves} ${e.waveCount}${wave} ${flags}`,
      `${d.startles}: ${e.startles}, ${d.jumpiness} ${e.jumpiness.toFixed(2)}${flustered}, ${d.lastPress}: ${press}`,
      `${d.microsleeps}: ${e.microsleeps}, ${d.sinceLast} ${since}`,
    ];
  }

  private routeLines(): string[] {
    const route = this.route;
    if (!route) return [];
    const d = STR.debug;
    const ride = this.session.state.ride;
    const offset = ride.offsetSec;
    const next = nextStop(route, offset);
    const home = homeStop(route);
    return [
      `${d.route}: ${route.lineName} ${route.headsign} (${route.id})`,
      `${d.position}: ${offset.toFixed(1)} s`,
      `${d.busPhase}: ${ride.phase} (${ride.timeInPhaseSec.toFixed(1)} s), ${d.speed} ${ride.speed.toFixed(2)}`,
      `${d.nextStop}: ${next ? `${next.name} @ ${next.offsetSec} s` : d.none}`,
      `${d.home}: ${home.name} @ ${home.offsetSec} s`,
    ];
  }
}
