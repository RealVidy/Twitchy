import { MUTE_TOGGLED, TOGGLE_MUTE, type MuteToggled, type ToggleMute } from '../shared/volume';
import { SEL } from './selectors';
import { formatLevel, showIndicator } from './volume';

/**
 * A click on the stream mutes or unmutes it, through Twitch's player (by way of the page script) so
 * its mute button follows. A double-click still goes full screen: its two clicks cancel out.
 * `boost` is the gain the wheel put on top of Twitch's volume, so the indicator shows the real level.
 */
export function installClickToMute(enabled: () => boolean, boost: () => number): void {
  let clicked: Element | null = null;
  /** A player menu was open when the button went down: Twitch closes it there, before the click. */
  let menuWasOpen = false;

  document.addEventListener('pointerdown', () => (menuWasOpen = !!document.querySelector(SEL.playerMenu)), true);
  // Capturing on the document runs before Twitch's own click handler, which we keep out of it.
  document.addEventListener(
    'click',
    (e) => {
      if (!enabled() || e.button !== 0 || e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
      if (!(e.target instanceof Element)) return;
      const player = e.target.closest(SEL.playerClickHandler)?.closest(SEL.videoPlayer);
      // With a settings menu open, the click only closes it, as on Twitch.
      if (!player || menuWasOpen || document.querySelector(SEL.playerMenu)) return;
      e.stopPropagation();
      clicked = player;
      const message: ToggleMute = { type: TOGGLE_MUTE };
      window.postMessage(message, location.origin);
    },
    true,
  );

  window.addEventListener('message', (e) => {
    const data = e.data as Partial<MuteToggled> | null;
    if (e.source !== window || data?.type !== MUTE_TOGGLED || !clicked?.isConnected) return;
    const volume = typeof data.volume === 'number' ? data.volume : 1;
    showIndicator(clicked, data.muted ? 'Muted' : formatLevel(volume * boost()));
  });
}
