import { fetchBttvChannel, fetchBttvGlobal } from './bttv';
import { fetchFfzChannel, fetchFfzGlobal, fetchFfzTwitchId } from './ffz';
import { fetchSevenTvChannel, fetchSevenTvGlobal } from './seventv';
import { fetchTwitchId } from './twitch';
import type { ChannelEmotes, Emote, EmoteSet, GetJson, Provider, Scope } from './types';

/** Returns the cached value for `key`, or runs `load` and caches its result for `ttlMs`. */
export type Cached = <T>(key: string, ttlMs: number, load: () => Promise<T>) => Promise<T>;

const MINUTE = 60_000;
const GLOBAL_TTL = 60 * MINUTE;
const CHANNEL_TTL = 5 * MINUTE;
const ID_TTL = 24 * 60 * MINUTE;

async function resolveTwitchId(getJson: GetJson, login: string): Promise<string | null> {
  try {
    const id = await fetchTwitchId(getJson, login);
    if (id) return id;
  } catch (err) {
    console.warn('[twitchy] Twitch id lookup failed, trying FFZ', err);
  }
  return fetchFfzTwitchId(getJson, login);
}

export async function loadChannelEmotes(
  getJson: GetJson,
  cached: Cached,
  login: string,
): Promise<ChannelEmotes> {
  const twitchId = await cached(`id:${login}`, ID_TTL, () => resolveTwitchId(getJson, login)).catch(
    (err) => {
      console.warn('[twitchy] could not find the Twitch id of', login, err);
      return null;
    },
  );

  let sevenTvSetId: string | null = null;
  const jobs: { provider: Provider; scope: Scope; load: () => Promise<Emote[]> }[] = [
    {
      provider: '7tv',
      scope: 'global',
      load: () => cached('global:7tv', GLOBAL_TTL, () => fetchSevenTvGlobal(getJson)),
    },
    {
      provider: 'bttv',
      scope: 'global',
      load: () => cached('global:bttv', GLOBAL_TTL, () => fetchBttvGlobal(getJson)),
    },
    {
      provider: 'ffz',
      scope: 'global',
      load: () => cached('global:ffz', GLOBAL_TTL, () => fetchFfzGlobal(getJson)),
    },
  ];

  if (twitchId) {
    jobs.push(
      {
        provider: '7tv',
        scope: 'channel',
        load: async () => {
          const res = await cached(`channel:7tv:${twitchId}`, CHANNEL_TTL, () =>
            fetchSevenTvChannel(getJson, twitchId),
          );
          sevenTvSetId = res.setId;
          return res.emotes;
        },
      },
      {
        provider: 'bttv',
        scope: 'channel',
        load: () =>
          cached(`channel:bttv:${twitchId}`, CHANNEL_TTL, () => fetchBttvChannel(getJson, twitchId)),
      },
      {
        provider: 'ffz',
        scope: 'channel',
        load: () =>
          cached(`channel:ffz:${twitchId}`, CHANNEL_TTL, () => fetchFfzChannel(getJson, twitchId)),
      },
    );
  }

  // One provider being down must not hide the emotes of the others.
  const results = await Promise.allSettled(jobs.map((j) => j.load()));
  const sets: EmoteSet[] = results.map((r, i) => {
    const { provider, scope } = jobs[i];
    if (r.status === 'rejected') {
      console.warn(`[twitchy] failed to load ${scope} ${provider} emotes`, r.reason);
      return { provider, scope, emotes: [] };
    }
    return { provider, scope, emotes: r.value };
  });

  return { login, twitchId, sevenTvSetId, sets };
}
