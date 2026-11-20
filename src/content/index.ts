import './styles.css';
import { EmoteRegistry } from '../emotes/registry';
import { applyEmoteSetUpdate } from '../emotes/seventv-updates';
import { EmoteUsage } from '../emotes/usage';
import { loadChannel, loadNotifications } from '../shared/messages';
import { DEFAULT_SETTINGS, loadSettings, watchSettings, type Settings } from '../shared/settings';
import { installAutocomplete } from './autocomplete';
import { channelFromPath } from './channel';
import { ColonComplete } from './colon-complete';
import { ChatObserver } from './chat-observer';
import { EmotePicker } from './emote-picker';
import { installLayout } from './layout';
import { installMessageHistory } from './message-history';
import { SevenTvLiveUpdates } from './live-updates';
import { NotificationBadges } from './notification-badges';
import { installTooltip } from './tooltip';

let settings: Settings = DEFAULT_SETTINGS;
const registry = new EmoteRegistry();
const usage = new EmoteUsage(chrome.storage.local);
const chat = new ChatObserver(registry, (names) => usage.record(names));
const picker = new EmotePicker(registry, (name) => usage.count(name), () => settings);
const colon = new ColonComplete(registry, (name) => usage.count(name), () => settings.colonAutocomplete);
const badges = new NotificationBadges(() => settings, loadNotifications);
const live = new SevenTvLiveUpdates((update) => {
  const emotes = applyEmoteSetUpdate(registry.getSet('7tv', 'channel'), update);
  registry.replaceSet('7tv', 'channel', emotes);
});
let currentLogin: string | null = null;

async function switchChannel(login: string | null): Promise<void> {
  currentLogin = login;
  registry.setSets([]);
  void usage.switchChannel(login);
  live.watch(null);
  if (!login) return;

  try {
    const data = await loadChannel(login);
    if (currentLogin !== login) return; // the user moved on while we were loading
    registry.setSets(data.sets);
    live.watch(data.sevenTvSetId);
    console.info(`[twitchy] ${registry.size} emotes for ${login}`);
    chat.rescan();
  } catch (err) {
    console.warn('[twitchy] could not load emotes for', login, err);
  }
}

function checkLocation(): void {
  const login = channelFromPath(location.pathname);
  if (login !== currentLogin) void switchChannel(login);
}

// Twitch is a single-page app and our isolated world cannot see its history.pushState calls,
// so we check the URL on popstate and on a short interval.
function applySettings(next: Settings): void {
  settings = next;
  document.documentElement.classList.toggle('twitchy-hide-locked', next.hideLockedEmotes);
  document.documentElement.classList.toggle('twitchy-hide-send-button', next.hideSendButton);
  picker.refresh();
  colon.schedule();
  badges.update();
}

window.addEventListener('popstate', checkLocation);
window.addEventListener('pagehide', () => void usage.flush());
window.setInterval(checkLocation, 1000);
checkLocation();
chat.start();
installTooltip();
colon.start();
installAutocomplete(registry, colon);
installMessageHistory(() => settings.messageHistory);
installLayout();
applySettings(settings);
picker.start();
badges.start();
watchSettings(applySettings);
loadSettings().then(applySettings, (err) => console.warn('[twitchy] could not load settings', err));
