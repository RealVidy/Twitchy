// Runs in Twitch's embedded player inside twitch.tv pages, where our sidebar previews play.
// Channels with content labels show their warning in there, where the twitch.tv content script
// cannot reach, and the preview would stay on its thumbnail.
import { installContentGateSkipper } from '../content/content-gate';
import { loadSettings, watchSettings, type Settings } from '../shared/settings';
import { embeddedInTwitch } from './embedded';

if (embeddedInTwitch()) {
  // Null until the saved settings are in: until then we don't know if skipping is off.
  let settings: Settings | null = null;
  const gate = installContentGateSkipper(() => settings?.skipContentWarning === true);
  const apply = (next: Settings) => {
    settings = next;
    gate.check();
  };
  watchSettings(apply);
  loadSettings().then(apply, (err) => console.warn('[twitchy] could not load settings', err));
}
