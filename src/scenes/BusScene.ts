import * as Phaser from 'phaser';
import { SoundKeys } from '../assets/manifest';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { formatTime } from '../core/clock';
import { clamp } from '../core/math';
import type { GameSession } from '../core/session';
import { BALANCE } from '../data/balance';
import { STR } from '../data/strings.fi';
import { BusInterior } from '../ui/BusInterior';
import { Eyelids } from '../ui/Eyelids';
import { MeterBar } from '../ui/MeterBar';
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
  blackout: 1100,
} as const;

const LOOK = BALANCE.drowsyLook;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class BusScene extends Phaser.Scene {
  private session!: GameSession;
  private scenery!: WindowScenery;
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
      bus.on('terminusReached', () => this.showTerminus()),
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
    this.blur = filters.addBlur(0, 1, 1, 0);
    this.vignette = filters.addVignette(0.5, 0.5, LOOK.vignetteRadius.rested, LOOK.vignetteStrength.rested);
  }

  private setUpInput(): void {
    const open = () => this.session.handleInput('openEyes');
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, true).on('down', open);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, open);
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
    this.tweens.add({ targets: this.interior.clock, scale: 1, duration: 900, ease: 'Back.easeOut' });
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
      .setOrigin(0.5)
      .setDepth(Depth.hint);
  }
}
