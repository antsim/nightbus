import * as Phaser from 'phaser';
import { SoundKeys } from '../assets/manifest';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { BusPhase } from '../core/busRide';
import { formatTime } from '../core/clock';
import type { GameSession } from '../core/session';
import { BALANCE } from '../data/balance';
import { STR } from '../data/strings.fi';
import { BusInterior } from '../ui/BusInterior';
import { DebugOverlay } from '../ui/DebugOverlay';
import { WindowScenery, type Rect } from '../ui/WindowScenery';
import { SceneKeys } from './keys';
import { getRoute, getSession } from './session';

const WINDOW: Rect = { x: 40, y: 70, width: 880, height: 260 };
const PILLARS_X = [330, 630];

export class BusScene extends Phaser.Scene {
  private session!: GameSession;
  private scenery!: WindowScenery;
  private interior!: BusInterior;
  private engine: Phaser.Sound.BaseSound | undefined;
  private lastPhase: BusPhase = 'dwelling';

  constructor() {
    super(SceneKeys.Bus);
  }

  create(): void {
    this.session = getSession(this);
    const route = getRoute(this);

    this.scenery = new WindowScenery(this, route, WINDOW);
    this.interior = new BusInterior(this, WINDOW, PILLARS_X);
    new DebugOverlay(this, this.session, route);

    if (this.cache.audio.exists(SoundKeys.engine)) {
      this.engine = this.sound.add(SoundKeys.engine, { loop: true, volume: 0.4 });
      this.engine.play();
    }

    const offs = [
      this.session.bus.on('stopDeparted', () => this.shake()),
      this.session.bus.on('terminusReached', () => this.showTerminus()),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offs.forEach((off) => off());
      this.engine?.destroy();
    });
  }

  override update(_time: number, delta: number): void {
    this.session.tick(delta);
    const ride = this.session.state.ride;

    if (ride.phase === 'braking' && this.lastPhase !== 'braking') this.shake();
    this.lastPhase = ride.phase;

    this.scenery.update(this.session.renderOffsetSec());
    this.interior.clock.setText(formatTime(this.session.state.clock.minutes));

    if (this.engine && 'setRate' in this.engine) {
      (this.engine as Phaser.Sound.WebAudioSound).setRate(0.7 + 0.5 * (ride.speed / BALANCE.bus.cruiseSpeed));
    }
  }

  /** Jolt on acceleration and braking; stronger when drunk. */
  private shake(): void {
    const s = BALANCE.scenery.shake;
    const intox = this.session.state.meters.intoxication.value;
    this.cameras.main.shake(s.durationMs, s.intensity * (1 + s.perIntox * intox));
  }

  private showTerminus(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 110, STR.bus.terminus, {
        fontFamily: 'sans-serif',
        fontSize: '26px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5);
  }
}
