import * as Phaser from 'phaser';
import { FONT_MONO, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { STR } from '../data/strings.fi';
import { appEvents } from '../services/appEvents';
import { loadBest } from '../services/bestScore';
import { installOption, promptInstall } from '../services/install';
import { applyUpdate, isUpdateReady } from '../services/pwa';
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

    this.setUpAppControls();
  }

  /** Update banner and install button/instructions. Shown only here, never during a ride. */
  private setUpAppControls(): void {
    let updateButton: TextButton | null = null;
    const showUpdate = () => {
      updateButton ??= new TextButton(this, GAME_WIDTH / 2, 28, STR.app.update, applyUpdate, {
        width: 420,
        height: 40,
        fontSize: 18,
        fill: 0x1f6f43,
        hoverFill: 0x2a8f58,
      });
    };
    if (isUpdateReady()) showUpdate();

    let install: TextButton | Phaser.GameObjects.Text | null = null;
    const showInstall = () => {
      install?.destroy();
      install = null;
      const option = installOption();
      if (option === 'prompt') {
        install = new TextButton(this, GAME_WIDTH - 120, GAME_HEIGHT - 32, STR.app.install, () => void promptInstall(), {
          width: 200,
          height: 40,
          fontSize: 17,
        });
      } else if (option === 'iosInstructions') {
        install = this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT - 32, STR.app.iosInstall, { fontFamily: 'sans-serif', fontSize: '16px', color: '#c8c8e0' })
          .setOrigin(0.5);
      }
    };
    showInstall();

    const offs = [
      appEvents.on('updateAvailable', showUpdate),
      appEvents.on('installAvailable', showInstall),
      appEvents.on('installed', showInstall),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }
}
