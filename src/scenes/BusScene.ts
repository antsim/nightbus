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
import { appEvents } from '../services/appEvents';
import { isPaused } from '../services/lifecycle';
import { keepScreenOn } from '../services/wakeLock';
import { BusInterior } from '../ui/BusInterior';
import { Eyelids, OVERSCAN } from '../ui/Eyelids';
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
  tint: 980,
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
  private nauseaBar!: MeterBar;
  private nauseaTint!: Phaser.GameObjects.Rectangle;
  /** Queasy subtitle shown; re-armed once nausea drops below the sway stage. */
  private queasyShown = false;
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

    this.scenery = new WindowScenery(this, route, WINDOW, {
      // Same garble as the ceiling display, at the current state.
      name: (index) => {
        const stop = route.stops[index];
        if (!stop) return '';
        const m = this.session.state.meters;
        const level = garbleLevel(m.intoxication.value, m.fatigue.value) * BALANCE.announcements.displayLevelFactor;
        return garble(stop.name, level, createRng(this.session.state.seed ^ Math.imul(index + 1, 0x2545f491)));
      },
      // Still waiting until the bus has stopped there.
      waiting: (index) => this.session.stopPlan(index).waiting && this.session.state.ride.stopIndex < index,
    });
    this.interior = new BusInterior(this, WINDOW, PILLARS_X);
    this.windowGlow = this.add
      .rectangle(WINDOW.x, WINDOW.y, WINDOW.width, WINDOW.height, 0xffd27a, 0)
      .setOrigin(0)
      .setDepth(Depth.windowGlow);

    this.fatigueBar = new MeterBar(
      this,
      GAME_WIDTH / 2 - 150,
      GAME_HEIGHT - 26,
      STR.hud.fatigue,
      { width: 120, height: 10, lowColor: 0x8fa8ff, highColor: 0xff6b6b },
      Depth.hud,
    );
    this.nauseaBar = new MeterBar(
      this,
      GAME_WIDTH / 2 + 90,
      GAME_HEIGHT - 26,
      STR.hud.nausea,
      { width: 120, height: 10, lowColor: 0xd8d0a0, highColor: 0x5fd03a },
      Depth.hud,
    );
    // Screen-space tint, below the eyelids so closing the eyes hides the green too.
    this.nauseaTint = this.add
      .rectangle(-OVERSCAN, -OVERSCAN, GAME_WIDTH + OVERSCAN * 2, GAME_HEIGHT + OVERSCAN * 2, LOOK.nausea.tintColor, 1)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(Depth.tint);
    this.queasyShown = false;
    this.eyelids = new Eyelids(this, Depth.eyelids);
    this.blackout = this.add
      .rectangle(-OVERSCAN, -OVERSCAN, GAME_WIDTH + OVERSCAN * 2, GAME_HEIGHT + OVERSCAN * 2, 0x000000, 1)
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
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 75, [...STR.bus.hint], {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        align: 'center',
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
      bus.on('startled', () => this.startle()),
      bus.on('requestTooLate', () => this.subtitle.show(STR.bus.tooLate, BALANCE.announcements.subtitleMs)),
      bus.on('nauseaCritical', () => this.subtitle.show(STR.bus.sick, BALANCE.announcements.subtitleMs)),
      bus.on('announcement', (a) => this.announce(a)),
      bus.on('runEnded', ({ outcome }) => this.endRun(outcome)),
    ];

    // Background or phone upright: freeze the ride (scene updates stop, so the game clock stops).
    offs.push(appEvents.on('pausedChanged', ({ paused }) => this.setPaused(paused)));
    keepScreenOn(true);

    this.scene.launch(SceneKeys.Debug);
    if (isPaused()) this.time.delayedCall(0, () => this.setPaused(true));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keepScreenOn(false);
      offs.forEach((off) => off());
      this.engine?.destroy();
      this.scene.stop(SceneKeys.Debug);
    });
  }

  private setPaused(paused: boolean): void {
    if (paused) this.scene.pause();
    else this.scene.resume();
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
    this.nauseaBar.set(s.meters.nausea.value);
    this.updateNausea(s.meters.nausea.value);
    this.interior.clock.setColor(confusion > 0 ? '#ff8080' : '#cfd8ff');
    // Ceiling light: anyone's request. Button glow: only the player's own.
    this.interior.setStopping(s.playerRequested || s.otherRequested);
    this.stopButton.setLit(s.playerRequested);
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

  /** Warning stages: sway from `warn.sway`, green tint and a subtitle from `warn.queasy`. */
  private updateNausea(nausea: number): void {
    const warn = BALANCE.nausea.warn;
    const look = LOOK.nausea;
    const cam = this.cameras.main;
    const sway = clamp((nausea - warn.sway) / (1 - warn.sway), 0, 1);
    const t = (this.time.now / 1000) * look.swayHz * Math.PI * 2;
    cam.setRotation(Math.sin(t) * look.swayRadians * sway);
    cam.setScroll(Math.sin(t * 0.6 + 1) * look.swayPx * sway, 0);

    const queasy = clamp((nausea - warn.queasy) / (1 - warn.queasy), 0, 1);
    this.nauseaTint.setAlpha(nausea >= warn.queasy ? (0.35 + 0.65 * queasy) * look.tintMaxAlpha : 0);

    if (nausea >= warn.queasy && !this.queasyShown && !this.session.state.sick) {
      this.queasyShown = true;
      this.subtitle.show(STR.bus.queasy, BALANCE.announcements.subtitleMs);
      if (this.cache.audio.exists(SoundKeys.urp)) this.sound.play(SoundKeys.urp);
    } else if (nausea < warn.sway) {
      this.queasyShown = false;
    }
  }

  /** Jolt on acceleration and braking; stronger when drunk. */
  private shake(): void {
    const sh = BALANCE.scenery.shake;
    const intox = this.session.state.meters.intoxication.value;
    this.cameras.main.shake(sh.durationMs, sh.intensity * (1 + sh.perIntox * intox));
  }

  /** Pressed too early: a small jerk and quivering lids, so the player learns to wait. */
  private startle(): void {
    const st = LOOK.startle;
    this.cameras.main.shake(st.shakeMs, st.shakeIntensity);
    this.eyelids.flutter(st.flutterAmount, st.flutterMs);
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
