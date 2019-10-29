import { Bind } from 'lodash-decorators';
import { round } from 'lodash-es';
import { Delayed } from '../../delay';
import { SoundAsset } from '../../loaders';
import { Stage } from '../../screen';
import { Linear, Tween } from '../../tween';
import { Random } from '../../util';
import { SoundLibrary } from './library';

export interface AudioFXOptions {
  loop?: boolean;
  rate?: number;
  fade?: number;
  randomStart?: boolean;
  position?: number;
}

class ConcreteSoundsPlayer {
  private volumeFader = {
    value: 1,
  };

  private playingSounds: { [key: number]: Howl } = {};

  public play(asset: SoundAsset, volume = -1, delay = 0, options?: AudioFXOptions): number | undefined {
    const item = SoundLibrary.getItemByAsset(asset);

    if (!item) {
      return;
    }

    const player = item.getPlayer();

    if (!player) {
      return;
    }

    const id = player.play();
    player.volume(0, id);

    player.once('play', () => this.registerPlayer(player, id), id);
    player.once('end', () => this.unregisterPlayer(player, id), id);
    player.once('stop', () => this.unregisterPlayer(player, id), id);

    if (options) {
      player.loop(options.loop || false, id);

      // snelheid meegegeven, of anders snelheid van de mainticker
      const rate = options.rate ? options.rate * Stage.timeScale : Stage.timeScale;
      player.rate(rate, id);

      if (options.randomStart === true) {
        const postition = round(Random.real(0, player.duration() * 0.9), 2);
        player.seek(postition, id);
      }

      if (options.position) {
        player.seek(options.position, id);
      }
    } else {
      // snelheid meegegeven
      player.rate(Stage.timeScale, id);
    }

    // fade?
    const targetVolume = volume === -1 ? 0.5 : volume;
    if (options && options.fade) {
      player.fade(0, targetVolume, options.fade * 1000, id);
    } else {
      player.volume(targetVolume, id);
    }

    // delay?
    // TODO fix/check delayed fade
    if (delay > 0) {
      player.pause();
      Delayed.call(player.play, delay, [id]);
    }

    return id;
  }

  private registerPlayer(player: Howl, id: number): void {
    this.playingSounds[id] = player;
  }

  private unregisterPlayer(player: Howl, id: number): void {
    delete this.playingSounds[id];
    player.off('play', undefined, id);
    player.off('end', undefined, id);
    player.off('stop', undefined, id);
  }

  public stop(asset: SoundAsset, options?: AudioFXOptions, id?: number): void {
    const item = SoundLibrary.getItemByAsset(asset);

    if (!item) {
      return;
    }

    const player = item.getPlayer();

    if (!player) {
      return;
    }

    // als er geen specifieke is meegegeven, stoppen we alle audio, dus dan ook alle delays
    if (!id) {
      Delayed.kill(player.play);
    }

    if (options && options.fade && options.fade > 0) {
      player.once(
        'fade',
        () => {
          player.stop(id);
        },
        id,
      );
      player.fade(player.volume(), 0, options.fade * 1000, id);
    } else {
      player.stop(id);
    }
  }

  public resumeAll(): void {
    for (const id in this.playingSounds) {
      const player = this.playingSounds[id];
      if (player.state() === 'loaded') {
        player.play(parseInt(id));
      } else {
        delete this.playingSounds[id];
      }
    }
  }

  public pauseAll(): void {
    for (const id in this.playingSounds) {
      const player = this.playingSounds[id];
      if (player.state() === 'loaded') {
        player.pause(parseInt(id));
      } else {
        delete this.playingSounds[id];
      }
    }
  }

  public fadeAllTo(target = 1, duration = 1): void {
    Tween.killTweensOf(this.volumeFader);
    this.volumeFader.value = Howler.volume();
    Tween.to(this.volumeFader, duration, { value: target, ease: Linear.easeNone, onUpdate: this.fadeAllUpdater });
  }

  @Bind
  private fadeAllUpdater(): void {
    Howler.volume(this.volumeFader.value);
  }

  public setVolume(_value: number): void {
    Howler.volume(_value);
  }
}

export const AudioFX = new ConcreteSoundsPlayer();
