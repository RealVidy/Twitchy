import { beforeEach, describe, expect, it } from 'vitest';
import { EmoteRegistry } from '../src/emotes/registry';
import { renderAll } from '../src/content/render';
import { tokenize } from '../src/content/tokenize';
import type { Emote } from '../src/providers/types';

function emote(name: string, zeroWidth = false): Emote {
  return {
    id: name,
    name,
    provider: '7tv',
    scope: 'channel',
    images: [
      { scale: 1, url: `https://cdn.example/${name}/1x.webp` },
      { scale: 2, url: `https://cdn.example/${name}/2x.webp` },
    ],
    width: 32,
    height: 32,
    animated: false,
    zeroWidth,
  };
}

const emotes = new Map(['KEKW', 'OMEGALUL', 'RainTime'].map((n) => [n, emote(n, n === 'RainTime')]));
const lookup = (n: string) => emotes.get(n);

describe('tokenize', () => {
  it('keeps text and spaces around emotes', () => {
    const tokens = tokenize('lol  KEKW that was OMEGALUL', lookup);
    expect(tokens.map((t) => (t.kind === 'text' ? t.text : `[${t.emote.name}]`)).join('')).toBe(
      'lol  [KEKW] that was [OMEGALUL]',
    );
  });

  it('is case-sensitive and does not match inside words', () => {
    expect(tokenize('kekw KEKWW xKEKW', lookup)).toEqual([{ kind: 'text', text: 'kekw KEKWW xKEKW' }]);
  });

  it('ignores invisible characters added to dodge duplicate checks', () => {
    const tokens = tokenize('KEKW ͏', lookup);
    expect(tokens[0]).toMatchObject({ kind: 'emote' });
    const withTag = tokenize('KEKW\u{e0000}', lookup);
    expect(withTag).toHaveLength(1);
    expect(withTag[0]).toMatchObject({ kind: 'emote' });
  });
});

describe('renderAll', () => {
  let registry: EmoteRegistry;

  beforeEach(() => {
    registry = new EmoteRegistry();
    registry.setSets([{ provider: '7tv', scope: 'channel', emotes: [...emotes.values()] }]);
    document.body.innerHTML = `
      <div data-test-selector="chat-scrollable-area__message-container">
        <span data-a-target="chat-line-message-body">
          <span class="text-fragment" data-a-target="chat-message-text">hi KEKW</span>
          <span class="mention-fragment">@KEKW</span>
          <span class="text-fragment" data-a-target="chat-message-text">no emotes here</span>
        </span>
      </div>`;
  });

  it('hides the original fragment and adds a copy with images', () => {
    renderAll(document.body, registry);
    const [first, second] = document.querySelectorAll<HTMLElement>('.text-fragment');
    expect(first.hidden).toBe(true);
    const copy = first.nextElementSibling as HTMLElement;
    expect(copy.className).toBe('twitchy-fragment');
    expect(copy.textContent).toBe('hi ');
    const img = copy.querySelector('img')!;
    expect(img.alt).toBe('KEKW');
    expect(img.getAttribute('srcset')).toContain('2x.webp 2x');

    expect(second.hidden).toBe(false);
    expect(document.querySelector('.mention-fragment')?.textContent).toBe('@KEKW');
  });

  it('renders each fragment once', () => {
    renderAll(document.body, registry);
    renderAll(document.body, registry);
    expect(document.querySelectorAll('.twitchy-fragment')).toHaveLength(1);
  });
});
