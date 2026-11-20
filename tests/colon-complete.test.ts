import { afterEach, describe, expect, it } from 'vitest';
import {
  ColonComplete,
  colonQuery,
  mergeSuggestions,
  rankMatches,
  twitchSuggestions,
  type Suggestion,
} from '../src/content/colon-complete';
import { EmoteRegistry } from '../src/emotes/registry';
import type { Emote } from '../src/providers/types';

function emote(name: string): Emote {
  return {
    id: name,
    name,
    provider: '7tv',
    scope: 'channel',
    images: [{ scale: 1, url: `https://cdn.example/${name}.webp` }],
    animated: false,
    zeroWidth: false,
  };
}

// jsdom does no layout, so it has no scrollIntoView.
Element.prototype.scrollIntoView ??= () => {};

const suggestion = (name: string, label = '7TV'): Suggestion => ({ name, src: '', srcset: '', label });

describe('colonQuery', () => {
  it('needs a colon starting the word and two more characters', () => {
    expect(colonQuery(':ke')).toBe('ke');
    expect(colonQuery('hello :KEK')).toBe('KEK');
    expect(colonQuery(':k')).toBeNull();
    expect(colonQuery('re:ke')).toBeNull();
    expect(colonQuery(':ke ')).toBeNull();
    expect(colonQuery('::ke')).toBeNull();
  });
});

describe('rankMatches', () => {
  const names = ['catKEK', 'KEKW', 'kekw', 'KEKWait', 'OMEGALUL', 'peepoKEK'];

  it('puts names that start with the query first, then names that contain it', () => {
    expect(rankMatches(names, 'kek', () => 0)).toEqual(['KEKW', 'kekw', 'KEKWait', 'catKEK', 'peepoKEK']);
  });

  it('orders each group by how much chat uses the emote', () => {
    const counts: Record<string, number> = { KEKWait: 4, peepoKEK: 2 };
    expect(rankMatches(names, 'kek', (n) => counts[n] ?? 0)).toEqual([
      'KEKWait',
      'KEKW',
      'kekw',
      'peepoKEK',
      'catKEK',
    ]);
  });

  it('stops at the limit', () => {
    expect(rankMatches(names, 'kek', () => 0, 2)).toEqual(['KEKW', 'kekw']);
  });
});

describe('mergeSuggestions', () => {
  it('lists ours before Twitch’s, and lets Twitch keep a name both have', () => {
    const merged = mergeSuggestions(
      [suggestion('KEKW'), suggestion('Kappa')],
      [suggestion('Kappa', 'Twitch'), suggestion('KappaPride', 'Twitch')],
    );
    expect(merged.map((s) => `${s.name}:${s.label}`)).toEqual(['KEKW:7TV', 'Kappa:Twitch', 'KappaPride:Twitch']);
  });
});

/** Twitch's chat box with `text` typed in it and the caret at the end. */
function typeInChat(text: string): HTMLElement {
  document.body.innerHTML = `
    <div class="chat-input">
      <div class="chat-input-tray__open"></div>
      <div data-a-target="chat-input" contenteditable="true"><span>${text}</span></div>
    </div>`;
  const editor = document.querySelector<HTMLElement>('[data-a-target="chat-input"]')!;
  const textNode = editor.querySelector('span')!.firstChild!;
  const range = document.createRange();
  range.setStart(textNode, text.length);
  range.collapse(true);
  getSelection()!.removeAllRanges();
  getSelection()!.addRange(range);
  return editor;
}

function showTwitchList(...names: string[]): void {
  document.querySelector('.chat-input-tray__open')!.innerHTML = `
    <div class="autocomplete-match-list">
      ${names.map((n) => `<button data-a-target="${n}"><img srcset="https://twitch.example/${n} 1x"></button>`).join('')}
    </div>`;
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const shown = () => [...document.querySelectorAll('.twitchy-colon__name')].map((el) => el.textContent);
const key = (k: string) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

describe('twitchSuggestions', () => {
  it('reads the names and images of Twitch’s own list', () => {
    typeInChat(':ka');
    showTwitchList('Kappa', 'KappaPride');
    expect(twitchSuggestions().map((s) => [s.name, s.srcset, s.label])).toEqual([
      ['Kappa', 'https://twitch.example/Kappa 1x', 'Twitch'],
      ['KappaPride', 'https://twitch.example/KappaPride 1x', 'Twitch'],
    ]);
  });
});

describe('ColonComplete', () => {
  const registry = new EmoteRegistry();
  registry.setSets([{ provider: '7tv', scope: 'channel', emotes: ['KEKW', 'KEKWait', 'catJAM'].map(emote) }]);
  let enabled = true;
  const colon = new ColonComplete(registry, () => 0, () => enabled);

  afterEach(async () => {
    enabled = true;
    document.body.innerHTML = '';
    colon.schedule();
    await frame();
  });

  it('lists our matches, then Twitch’s, and hides Twitch’s own list', async () => {
    typeInChat('hi :ke');
    showTwitchList('KEKW', 'Kappa');
    colon.schedule();
    await frame();
    expect(shown()).toEqual(['KEKWait', 'KEKW', 'Kappa']);
    expect(document.documentElement.classList.contains('twitchy-colon-open')).toBe(true);
  });

  it('moves with the arrows and replaces the :word with the chosen emote on Enter', async () => {
    const editor = typeInChat(':ke');
    colon.schedule();
    await frame();
    expect(shown()).toEqual(['KEKW', 'KEKWait']);

    const edits: string[] = [];
    // Like Slate, which makes the edit itself.
    editor.addEventListener('beforeinput', (e) => {
      e.preventDefault();
      edits.push(`${e.inputType}:${e.data ?? ''}`);
    });
    expect(colon.handleKey(key('ArrowDown'))).toBe(true);
    const enter = key('Enter');
    expect(colon.handleKey(enter)).toBe(true);
    expect(enter.defaultPrevented).toBe(true);
    expect(edits).toEqual([
      'deleteContentBackward:',
      'deleteContentBackward:',
      'deleteContentBackward:',
      'insertText:KEKWait ',
    ]);
    expect(colon.isOpen).toBe(false);
  });

  it('stays closed after Escape until the word changes', async () => {
    typeInChat(':ke');
    colon.schedule();
    await frame();
    expect(colon.handleKey(key('Escape'))).toBe(false);
    colon.schedule();
    await frame();
    expect(colon.isOpen).toBe(false);

    typeInChat(':kek');
    colon.schedule();
    await frame();
    expect(colon.isOpen).toBe(true);
  });

  it('leaves keys alone when closed or turned off', async () => {
    enabled = false;
    typeInChat(':ke');
    colon.schedule();
    await frame();
    expect(colon.isOpen).toBe(false);
    expect(colon.handleKey(key('Enter'))).toBe(false);
  });
});
