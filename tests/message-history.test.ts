import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const box = vi.hoisted(() => ({ text: '' }));
vi.mock('../src/content/chat-input', () => ({
  chatText: () => box.text,
  setChatText: vi.fn(async (text: string) => void (box.text = text)),
}));

import { setChatText } from '../src/content/chat-input';
import { installMessageHistory, MAX_ENTRIES, MessageHistory } from '../src/content/message-history';

function sent(...messages: string[]): MessageHistory {
  const h = new MessageHistory();
  for (const m of messages) h.record(m);
  return h;
}

describe('MessageHistory', () => {
  it('goes back from an empty box, newest first, and stops at the oldest', () => {
    const h = sent('one', 'two', 'three');
    expect(h.older('')).toBe('three');
    expect(h.older('three')).toBe('two');
    expect(h.older('two')).toBe('one');
    expect(h.older('one')).toBe('one');
  });

  it('comes forward with Down and ends on an empty box', () => {
    const h = sent('one', 'two');
    h.older('');
    h.older('two');
    expect(h.newer('one')).toBe('two');
    expect(h.newer('two')).toBe('');
    expect(h.newer('')).toBeNull();
  });

  it('leaves the keys alone when the box holds text of your own', () => {
    const h = sent('one');
    expect(h.older('draft')).toBeNull();
    expect(h.newer('draft')).toBeNull();
    expect(new MessageHistory().older('')).toBeNull();
  });

  it('stops browsing once you edit the message it brought back', () => {
    const h = sent('one', 'two');
    h.older('');
    expect(h.older('two!')).toBeNull();
    expect(h.newer('two!')).toBeNull();
    expect(h.older('')).toBe('two');
  });

  it('trims, skips empty messages and repeats, and starts over after sending', () => {
    const h = sent('  hi  ', 'hi', '   ', 'yo');
    h.older('');
    h.record('again');
    expect(h.older('')).toBe('again');
    expect(h.older('again')).toBe('yo');
    expect(h.older('yo')).toBe('hi');
    expect(h.older('hi')).toBe('hi');
  });

  it(`keeps the last ${MAX_ENTRIES} messages`, () => {
    const h = sent(...Array.from({ length: MAX_ENTRIES + 5 }, (_, i) => `m${i}`));
    let text = '';
    for (let i = 0; i < MAX_ENTRIES + 5; i++) text = h.older(text)!;
    expect(text).toBe('m5');
  });
});

describe('installMessageHistory', () => {
  let enabled = true;
  let editor: HTMLElement;

  beforeAll(() => {
    installMessageHistory(() => enabled);
  });

  afterEach(() => {
    document.body.replaceChildren();
    box.text = '';
    enabled = true;
    vi.mocked(setChatText).mockClear();
  });

  function setup(): void {
    document.body.innerHTML = `
      <div class="chat-input">
        <div data-a-target="chat-input" contenteditable="true"></div>
        <button data-a-target="chat-send-button">Chat</button>
      </div>`;
    editor = document.querySelector('[data-a-target="chat-input"]')!;
  }

  function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    editor.dispatchEvent(e);
    return e;
  }

  function send(text: string): void {
    box.text = text;
    press('Enter');
    box.text = ''; // Twitch empties the box
  }

  it('records messages sent with Enter or the Chat button and brings them back', async () => {
    setup();
    send('first');
    box.text = 'second';
    document.querySelector<HTMLButtonElement>('[data-a-target="chat-send-button"]')!.click();
    box.text = '';

    const e = press('ArrowUp');
    expect(e.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(box.text).toBe('second'));
    press('ArrowUp');
    await vi.waitFor(() => expect(box.text).toBe('first'));
    press('ArrowDown');
    await vi.waitFor(() => expect(box.text).toBe('second'));
  });

  it('does not record Shift+Enter, and leaves keys to an open Twitch list', () => {
    setup();
    box.text = 'nope';
    press('Enter', { shiftKey: true });
    document.body.insertAdjacentHTML('beforeend', '<div class="autocomplete-match-list"></div>');
    press('Enter');
    box.text = '';
    expect(press('ArrowUp').defaultPrevented).toBe(false);
    document.querySelector('.autocomplete-match-list')!.remove();
    press('ArrowUp');
    expect(setChatText).not.toHaveBeenCalledWith('nope');
  });

  it('does nothing when turned off', () => {
    setup();
    send('hello');
    enabled = false;
    expect(press('ArrowUp').defaultPrevented).toBe(false);
    expect(setChatText).not.toHaveBeenCalled();
  });
});
