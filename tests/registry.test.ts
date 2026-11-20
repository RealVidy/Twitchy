import { describe, expect, it } from 'vitest';
import { EmoteRegistry } from '../src/emotes/registry';
import type { Emote, Provider, Scope } from '../src/providers/types';

function emote(name: string, provider: Provider, scope: Scope): Emote {
  return { id: `${provider}-${scope}-${name}`, name, provider, scope, images: [], animated: false, zeroWidth: false };
}

describe('EmoteRegistry', () => {
  it('prefers channel over global, then 7TV over BTTV over FFZ', () => {
    const r = new EmoteRegistry();
    r.setSets([
      { provider: 'ffz', scope: 'global', emotes: [emote('A', 'ffz', 'global'), emote('B', 'ffz', 'global')] },
      { provider: 'bttv', scope: 'channel', emotes: [emote('A', 'bttv', 'channel')] },
      { provider: '7tv', scope: 'global', emotes: [emote('B', '7tv', 'global')] },
      { provider: '7tv', scope: 'channel', emotes: [emote('C', '7tv', 'channel')] },
      { provider: 'ffz', scope: 'channel', emotes: [emote('C', 'ffz', 'channel')] },
    ]);
    expect(r.get('A')?.id).toBe('bttv-channel-A');
    expect(r.get('B')?.id).toBe('7tv-global-B');
    expect(r.get('C')?.id).toBe('7tv-channel-C');
    expect(r.size).toBe(3);
  });

  it('is case-sensitive and lists names case-insensitively sorted', () => {
    const r = new EmoteRegistry();
    r.setSets([{ provider: '7tv', scope: 'global', emotes: ['b', 'KEKW', 'a', 'kekw'].map((n) => emote(n, '7tv', 'global')) }]);
    expect(r.get('KEKW')).toBeDefined();
    expect(r.get('Kekw')).toBeUndefined();
    expect(r.names()).toEqual(['a', 'b', 'KEKW', 'kekw']);
  });

  it('replaces one set and notifies listeners', () => {
    const r = new EmoteRegistry();
    r.setSets([{ provider: '7tv', scope: 'channel', emotes: [emote('old', '7tv', 'channel')] }]);
    let calls = 0;
    r.onChange(() => calls++);
    r.replaceSet('7tv', 'channel', [emote('new', '7tv', 'channel')]);
    expect(r.get('old')).toBeUndefined();
    expect(r.get('new')).toBeDefined();
    expect(calls).toBe(1);
  });
});
