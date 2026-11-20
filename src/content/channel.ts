// Twitch paths that are not channels, so `/directory` is not read as a channel login.
const RESERVED = new Set([
  'directory',
  'downloads',
  'drops',
  'friends',
  'inventory',
  'jobs',
  'messages',
  'p',
  'payments',
  'search',
  'settings',
  'subscriptions',
  'turbo',
  'wallet',
  'videos',
]);

const LOGIN = /^[a-z0-9_]{1,25}$/i;

/** Returns the channel login for a Twitch path, or null when the page has no channel chat. */
export function channelFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean).map((p) => p.toLowerCase());
  if (parts.length === 0) return null;

  let login: string | undefined;
  if (parts[0] === 'popout' || parts[0] === 'embed') {
    // /popout/{login}/chat, /embed/{login}/chat
    if (parts[2] === 'chat') login = parts[1];
  } else if (parts[0] === 'moderator') {
    login = parts[1];
  } else {
    login = parts[0];
  }

  if (!login || RESERVED.has(login) || !LOGIN.test(login)) return null;
  return login;
}
