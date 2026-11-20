import { describe, expect, it } from 'vitest';
import { applyEmoteSetUpdate } from '../src/emotes/seventv-updates';
import { parseSevenTvSet } from '../src/providers/seventv';
import sevenTvUser from './fixtures/7tv-user.json';

const raw = sevenTvUser.emote_set.emotes;
const current = parseSevenTvSet({ id: 'set', emotes: raw.slice(0, 2) }, 'channel');
const names = (list: { name: string }[]) => list.map((e) => e.name);

describe('applyEmoteSetUpdate', () => {
  it('adds pushed emotes', () => {
    const next = applyEmoteSetUpdate(current, { id: 'set', pushed: [{ key: 'emotes', value: raw[2] }] });
    expect(names(next)).toEqual([raw[0].name, raw[1].name, raw[2].name]);
    expect(next[2].zeroWidth).toBe(true);
  });

  it('removes pulled emotes', () => {
    const next = applyEmoteSetUpdate(current, { id: 'set', pulled: [{ key: 'emotes', old_value: raw[0] }] });
    expect(names(next)).toEqual([raw[1].name]);
  });

  it('renames updated emotes', () => {
    const next = applyEmoteSetUpdate(current, {
      id: 'set',
      updated: [{ key: 'emotes', old_value: raw[0], value: { ...raw[0], name: 'Renamed' } }],
    });
    expect(names(next)).toEqual([raw[1].name, 'Renamed']);
    expect(next[1].id).toBe(raw[0].id);
  });

  it('builds cdn urls when the event has no emote data', () => {
    const next = applyEmoteSetUpdate([], { id: 'set', pushed: [{ key: 'emotes', value: { id: 'abc', name: 'New' } }] });
    expect(next[0].images[0].url).toBe('https://cdn.7tv.app/emote/abc/1x.webp');
  });

  it('ignores changes to other fields', () => {
    const next = applyEmoteSetUpdate(current, { id: 'set', updated: [{ key: 'name', value: null }] });
    expect(next).toEqual(current);
  });
});
