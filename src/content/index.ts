import './styles.css';
import { EmoteRegistry } from '../emotes/registry';
import { applyEmoteSetUpdate } from '../emotes/seventv-updates';
import { loadChannel } from '../shared/messages';
import { installAutocomplete } from './autocomplete';
import { channelFromPath } from './channel';
import { ChatObserver } from './chat-observer';
import { SevenTvLiveUpdates } from './live-updates';
import { installTooltip } from './tooltip';

const registry = new EmoteRegistry();
const chat = new ChatObserver(registry);
const live = new SevenTvLiveUpdates((update) => {
  const emotes = applyEmoteSetUpdate(registry.getSet('7tv', 'channel'), update);
  registry.replaceSet('7tv', 'channel', emotes);
});
let currentLogin: string | null = null;

async function switchChannel(login: string | null): Promise<void> {
  currentLogin = login;
  registry.setSets([]);
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
window.addEventListener('popstate', checkLocation);
window.setInterval(checkLocation, 1000);
checkLocation();
chat.start();
installTooltip();
installAutocomplete(registry);
