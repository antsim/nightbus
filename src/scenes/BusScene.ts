import * as Phaser from 'phaser';
import { SoundKeys } from '../assets/manifest';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { formatTime } from '../core/clock';
import type { Announcement } from '../core/events';
import { garble, garbleLevel } from '../core/garble';
import { clamp } from '../core/math';
import type { Outcome } from '../core/outcome';
import { createRng, type Rng } from '../core/rng';
import { nextStop, type Route } from '../core/route';
import type { GameSession } from '../core/session';
import { BALANCE } from '../data/balance';
import { STR } from '../data/strings.fi';
import { BusInterior } from '../ui/BusInterior';
import { Eyelids } from '../ui/Eyelids';
import { MeterBar } from '../ui/MeterBar';
import { StopButton } from '../ui/StopButton';
import { Subtitle } from '../ui/Subtitle';
import { WindowScenery, type Rect } from '../ui/WindowScenery';
import { SceneKeys } from './keys';
import { getRoute, getSession } from './session';

const WINDOW: Rect = { x: 40, y: 70, width: 880, height: 260 };
const PILLARS_X = [330, 630];

const Depth = {
  windowGlow: 500,
  hud: 900,
  hint: 950,
  eyelids: 1000,
  /** Controls stay usable (and visible) with eyes closed. */
  controls: 1050,
  blackout: 1100,
} as const;

/** Real ms between getting off and the result screen. */
const RESULT_DELAY_MS = 2500;

const LOOK = BALANCE.drowsyLook;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class BusScene extends Phaser.Scene {
  private session!: GameSession;
  private route!: Route;
  private scenery!: WindowScenery;
  private subtitle!: Subtitle;
  private stopButton!: StopButton;
  /** Garbled stop name currently on the ceiling display. */
  private displayName: string | null = null;
  /** Randomness for display flicker, seeded per announcement (core RNG). */
  private flickerRng: Rng = createRng(0);
  private flickerMs = 0;
  private flickerName = '';
  private interior!: BusInterior;
  private eyelids!: Eyelids;
  private fatigueBar!: MeterBar;
  private blackout!: Phaser.GameObjects.Rectangle;
  private asleepText!: Phaser.GameObjects.Text;
  private windowGlow!: Phaser.GameObjects.Rectangle;
  private vignette: Phaser.Filters.Vignette | undefined;
  private blur: Phaser.Filters.Blur | undefined;
  private engine: Phaser.Sound.BaseSound | undefined;

  constructor() {
    super(SceneKeys.Bus);
  }

  create(): void {
    this.session = getSession(this);
    const route = getRoute(this);
    this.route = route;
    this.displayName = null;
    this.flickerMs = 0;

    this.scenery = new WindowScenery(this, route, WINDOW);
    this.interior = new BusInterior(this, WINDOW, PILLARS_X);
    this.windowGlow = this.add
      .rectangle(WINDOW.x, WINDOW.y, WINDOW.width, WINDOW.height, 0xffd27a, 0)
      .setOrigin(0)
      .setDepth(Depth.windowGlow);

    this.fatigueBar = new MeterBar(
      this,
      GAME_WIDTH / 2 - 40,
      GAME_HEIGHT - 18,
      STR.hud.fatigue,
      { width: 120, height: 6, lowColor: 0x8fa8ff, highColor: 0xff6b6b },
      Depth.hud,
    );
    this.eyelids = new Eyelids(this, Depth.eyelids);
    this.blackout = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 1)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(Depth.blackout);
    this.asleepText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, STR.bus.asleep, { fontFamily: 'serif', fontSize: '28px', color: '#555570' })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(Depth.blackout + 1);

    this.subtitle = new Subtitle(this, GAME_HEIGHT - 125, Depth.hint);
    this.stopButton = new StopButton(this, GAME_WIDTH - 70, GAME_HEIGHT - 80, 44, Depth.controls, () =>
      this.session.handleInput('requestStop'),
    );

    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 60, STR.bus.hint, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(Depth.hint);
    this.tweens.add({ targets: hint, alpha: 0, delay: 6000, duration: 1000, onComplete: () => hint.destroy() });

    this.cameras.main.resetFX();
    this.setUpFilters();
    this.setUpInput();

    if (this.cache.audio.exists(SoundKeys.engine)) {
      this.engine = this.sound.add(SoundKeys.engine, { loop: true, volume: 0.4 });
      this.engine.play();
    }

    const bus = this.session.bus;
    const offs = [
      bus.on('stopDeparted', () => this.shake()),
      bus.on('jolt', ({ source }) => source === 'brake' && this.shake()),
      bus.on('streetLightPassed', () => this.flashStreetLight()),
      bus.on('microsleep', () => this.fallAsleep()),
      bus.on('wokeUp', () => this.wakeUp()),
      bus.on('announcement', (a) => this.announce(a)),
      bus.on('runEnded', ({ outcome }) => this.endRun(outcome)),
    ];

    this.scene.launch(SceneKeys.Debug);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offs.forEach((off) => off());
      this.engine?.destroy();
      this.scene.stop(SceneKeys.Debug);
    });
  }

  private setUpFilters(): void {
    // Phaser 4 filters are WebGL-only; on Canvas the eyelids alone carry the effect.
    if (this.renderer.type !== Phaser.WEBGL) return;
    const filters = this.cameras.main.filters.external;
    filters.clear();
    this.blur = filters.addBlur(0, 1, 1, 0);
    this.vignette = filters.addVignette(0.5, 0.5, LOOK.vignetteRadius.rested, LOOK.vignetteStrength.rested);
  }

  private setUpInput(): void {
    const open = () => this.session.handleInput('openEyes');
    const stop = () => {
      this.stopButton.press(this);
      this.session.handleInput('requestStop');
    };
    const keys = Phaser.Input.Keyboard.KeyCodes;
    const keyboard = this.input.keyboard;
    keyboard?.addKey(keys.SPACE, true).on('down', open);
    keyboard?.addKey(keys.S, true).on('down', stop);
    keyboard?.addKey(keys.ENTER, true).on('down', stop);
    // A tap anywhere opens the eyes, except on the stop button.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!over.includes(this.stopButton.hitArea)) open();
    });
  }

  override update(_time: number, delta: number): void {
    this.session.tick(delta);
    const s = this.session.state;

    this.scenery.update(this.session.renderOffsetSec());
    this.interior.clock.setText(formatTime(s.clock.minutes));

    const fatigue = s.meters.fatigue.value;
    const eyelid = this.session.renderEyelid();
    const confusion = s.drowsiness.confusedMs / BALANCE.sleep.confusionMs;
    this.eyelids.set(eyelid);
    this.fatigueBar.set(fatigue);
    this.interior.clock.setColor(confusion > 0 ? '#ff8080' : '#cfd8ff');
    this.interior.setStopping(s.stopRequested);
    this.stopButton.setLit(s.stopRequested);
    this.updateDisplay(delta);

    if (this.vignette) {
      const r = LOOK.vignetteRadius;
      this.vignette.radius = lerp(r.rested, r.exhausted, fatigue) - r.perEyelid * eyelid;
      this.vignette.strength = lerp(LOOK.vignetteStrength.rested, LOOK.vignetteStrength.exhausted, fatigue);
    }
    if (this.blur) {
      const tired = clamp((fatigue - LOOK.blurFromFatigue) / (1 - LOOK.blurFromFatigue), 0, 1);
      const amount = tired * LOOK.blurMax + eyelid * LOOK.blurPerEyelid + confusion * LOOK.confusionBlur;
      this.blur.strength = amount;
      this.blur.active = amount > 0.05;
    }

    if (this.engine && 'setRate' in this.engine) {
      (this.engine as Phaser.Sound.WebAudioSound).setRate(0.7 + 0.5 * (s.ride.speed / BALANCE.bus.cruiseSpeed));
    }
  }

  /** Jolt on acceleration and braking; stronger when drunk. */
  private shake(): void {
    const sh = BALANCE.scenery.shake;
    const intox = this.session.state.meters.intoxication.value;
    this.cameras.main.shake(sh.durationMs, sh.intensity * (1 + sh.perIntox * intox));
  }

  private flashStreetLight(): void {
    this.tweens.killTweensOf(this.windowGlow);
    this.windowGlow.setFillStyle(0xffd27a, 0.12);
    this.tweens.add({ targets: this.windowGlow, fillAlpha: 0, duration: 300 });
  }

  private fallAsleep(): void {
    this.tweens.killTweensOf([this.blackout, this.asleepText]);
    this.tweens.add({ targets: this.blackout, alpha: 1, duration: 250 });
    this.tweens.add({ targets: this.asleepText, alpha: 1, delay: 300, duration: 600 });
  }

  /** "Where am I?": jolt, flash, and the clock visibly jumping. */
  private wakeUp(): void {
    this.tweens.killTweensOf([this.blackout, this.asleepText, this.interior.clock]);
    this.asleepText.setAlpha(0);
    this.tweens.add({ targets: this.blackout, alpha: 0, duration: 400 });
    this.cameras.main.shake(400, 0.008);
    this.cameras.main.flash(250, 255, 240, 200);
    this.interior.clock.setScale(1.8);

    // The display shows where the bus is now: an unfamiliar stop name.
    const s = this.session.state;
    const next = nextStop(this.route, s.ride.offsetSec);
    if (next) {
      const level = garbleLevel(s.meters.intoxication.value, s.meters.fatigue.value);
      const rng = createRng(s.seed + s.drowsiness.microsleeps * 7919);
      this.displayName = garble(next.name, level * BALANCE.announcements.displayLevelFactor, rng);
    }
    this.tweens.add({ targets: this.interior.clock, scale: 1, duration: 900, ease: 'Back.easeOut' });
  }

  private announce(a: Announcement): void {
    const rng = createRng(a.seed);
    this.subtitle.show(garble(STR.bus.announcement(a.stopName), a.level, rng), BALANCE.announcements.subtitleMs);
    this.displayName = garble(a.stopName, a.level * BALANCE.announcements.displayLevelFactor, rng);
    this.flickerRng = createRng(a.seed ^ 0x5bd1e995);
    this.flickerMs = 0;
  }

  /** Ceiling display; when drunk it sometimes flashes a wrong stop. */
  private updateDisplay(deltaMs: number): void {
    const a = BALANCE.announcements;
    const intox = this.session.state.meters.intoxication.value;
    const chance = clamp((intox - a.flickerFromIntox) / (1 - a.flickerFromIntox), 0, 1) * a.flickerPerSec * (deltaMs / 1000);
    if (this.flickerMs > 0) {
      this.flickerMs -= deltaMs;
    } else if (this.displayName && this.flickerRng.next() < chance) {
      this.flickerMs = a.flickerMs;
      this.flickerName = this.flickerRng.pick(this.route.stops).name;
    }
    const name = this.flickerMs > 0 ? this.flickerName : this.displayName;
    this.interior.stopDisplay.setText(name ? STR.bus.nextStop(name) : STR.bus.nextStopUnknown);
  }

  private endRun(outcome: Outcome): void {
    const alight = this.session.state.alight;
    const message = outcome.kind === 'terminus' || !alight ? STR.bus.terminus : STR.bus.alighted(alight.stopName);
    this.subtitle.show(message, 0);
    const fadeMs = 600;
    this.time.delayedCall(RESULT_DELAY_MS - fadeMs, () => this.cameras.main.fadeOut(fadeMs));
    this.time.delayedCall(RESULT_DELAY_MS, () => this.scene.start(SceneKeys.Result));
  }

}
