import './styles.css';
import { EmoteRegistry } from '../emotes/registry';
import { loadChannel } from '../shared/messages';
import { channelFromPath } from './channel';
import { ChatObserver } from './chat-observer';

const registry = new EmoteRegistry();
const chat = new ChatObserver(registry);
let currentLogin: string | null = null;

async function switchChannel(login: string | null): Promise<void> {
  currentLogin = login;
  registry.setSets([]);
  if (!login) return;

  try {
    const data = await loadChannel(login);
    if (currentLogin !== login) return; // the user moved on while we were loading
    registry.setSets(data.sets);
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
