import { describe, expect, it } from 'vitest';
import { parseBttvEmotes } from '../src/providers/bttv';
import { parseFfzGlobal, parseFfzRoom } from '../src/providers/ffz';
import { loadChannelEmotes, type Cached } from '../src/providers';
import { parseSevenTvSet } from '../src/providers/seventv';
import type { GetJson } from '../src/providers/types';
import bttvGlobal from './fixtures/bttv-global.json';
import bttvUser from './fixtures/bttv-user.json';
import ffzGlobal from './fixtures/ffz-global.json';
import ffzRoom from './fixtures/ffz-room.json';
import sevenTvGlobal from './fixtures/7tv-global.json';
import sevenTvUser from './fixtures/7tv-user.json';

describe('7TV', () => {
  const emotes = parseSevenTvSet(sevenTvGlobal, 'global');

  it('builds https webp urls for each scale', () => {
    const e = emotes[0];
    expect(e.provider).toBe('7tv');
    expect(e.images.map((i) => i.scale)).toEqual([1, 2, 3, 4]);
    expect(e.images[0].url).toMatch(/^https:\/\/cdn\.7tv\.app\/emote\/\w+\/1x\.webp$/);
    expect(e.width).toBeGreaterThan(0);
  });

  it('marks zero-width emotes', () => {
    expect(emotes.find((e) => e.name === 'RainTime')?.zeroWidth).toBe(true);
    expect(emotes[0].zeroWidth).toBe(false);
  });

  it('reads the channel set', () => {
    const channel = parseSevenTvSet(sevenTvUser.emote_set, 'channel');
    expect(channel).toHaveLength(3);
    expect(channel.every((e) => e.scope === 'channel')).toBe(true);
  });
});

describe('BTTV', () => {
  const emotes = parseBttvEmotes(bttvGlobal, 'global');

  it('skips text modifiers like c!', () => {
    expect(emotes.map((e) => e.name)).not.toContain('c!');
  });

  it('marks known overlay emotes as zero-width', () => {
    expect(emotes.find((e) => e.name === 'cvHazmat')?.zeroWidth).toBe(true);
    expect(emotes.find((e) => e.name === 'CiGrip')?.zeroWidth).toBe(false);
  });

  it('builds cdn urls', () => {
    const e = emotes.find((e) => e.name === 'CiGrip')!;
    expect(e.images.at(-1)?.url).toBe(`https://cdn.betterttv.net/emote/${e.id}/3x.webp`);
  });

  it('includes shared emotes of a channel', () => {
    const channel = parseBttvEmotes([...bttvUser.channelEmotes, ...bttvUser.sharedEmotes], 'channel');
    expect(channel).toHaveLength(3);
  });
});

describe('FFZ', () => {
  it('only reads the default global sets', () => {
    const names = parseFfzGlobal(ffzGlobal).map((e) => e.name);
    expect(names).toHaveLength(2);
    const otherSet = ffzGlobal.sets['1532818'].emoticons[0].name;
    expect(names).not.toContain(otherSet);
  });

  it('skips hidden effect modifiers like ffzHyper', () => {
    const names = parseFfzRoom(ffzRoom).map((e) => e.name);
    expect(names).toHaveLength(2);
    expect(names).not.toContain('ffzHyper');
  });

  it('uses scales 1, 2 and 4', () => {
    const e = parseFfzRoom(ffzRoom)[0];
    expect(e.images.map((i) => i.scale)).toEqual([1, 2, 4]);
    expect(e.width).toBeGreaterThan(0);
  });
});

describe('loadChannelEmotes', () => {
  const noCache: Cached = (_key, _ttl, load) => load();
  const responses: Record<string, unknown> = {
    'https://7tv.io/v3/emote-sets/global': sevenTvGlobal,
    'https://7tv.io/v3/users/twitch/71092938': sevenTvUser,
    'https://api.betterttv.net/3/cached/emotes/global': bttvGlobal,
    'https://api.betterttv.net/3/cached/users/twitch/71092938': bttvUser,
    'https://api.frankerfacez.com/v1/set/global': ffzGlobal,
    'https://api.frankerfacez.com/v1/room/id/71092938': ffzRoom,
    'https://gql.twitch.tv/gql': { data: { user: { id: '71092938' } } },
  };
  const getJson: GetJson = async (url) => {
    if (url.includes('frankerfacez.com/v1/room/id')) throw new Error('FFZ is down');
    return responses[url] ?? null;
  };

  it('loads all sets and keeps going when a provider fails', async () => {
    const res = await loadChannelEmotes(getJson, noCache, 'xqc');
    expect(res.twitchId).toBe('71092938');
    expect(res.sevenTvSetId).toBe(sevenTvUser.emote_set.id);
    expect(res.sets).toHaveLength(6);
    expect(res.sets.find((s) => s.provider === 'ffz' && s.scope === 'channel')?.emotes).toEqual([]);
    expect(res.sets.find((s) => s.provider === '7tv' && s.scope === 'channel')?.emotes).toHaveLength(3);
  });

  it('only loads global sets when the channel is unknown', async () => {
    const res = await loadChannelEmotes(async () => null, noCache, 'nobody');
    expect(res.twitchId).toBeNull();
    expect(res.sets.map((s) => s.scope)).toEqual(['global', 'global', 'global']);
  });
});
