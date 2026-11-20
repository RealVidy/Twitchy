import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChatObserver } from '../src/content/chat-observer';
import { messageFromLabel } from '../src/content/deleted-messages';
import { emoteOfImage } from '../src/content/render';
import { EmoteRegistry } from '../src/emotes/registry';
import type { Emote } from '../src/providers/types';

const KEKW: Emote = {
  id: 'kekw',
  name: 'KEKW',
  provider: '7tv',
  scope: 'channel',
  images: [{ scale: 1, url: 'https://cdn.example/KEKW.webp' }],
  animated: false,
  zeroWidth: false,
};

/** A chat line the way Twitch builds it, trimmed to the parts we use. */
function line(user: string, text: string): string {
  return `
    <div class="chat-line__message" data-a-target="chat-line-message" aria-label="${user}: ${text}">
      <div class="inner">
        <span class="chat-line__username">${user}</span><span aria-hidden="true">: </span>
        <span data-a-target="chat-line-message-body">
          <span class="text-fragment" data-a-target="chat-message-text">${text}</span>
        </span>
      </div>
    </div>`;
}

const notice = () => {
  const span = document.createElement('span');
  span.className = 'chat-line__message--deleted-notice';
  span.dataset.aTarget = 'chat-deleted-message-placeholder';
  span.textContent = 'message deleted by a moderator.';
  return span;
};

/** What Twitch does when a moderator deletes a message: body out, notice in, same spot. */
function deleteMessage(chatLine: Element): void {
  const body = chatLine.querySelector('[data-a-target="chat-line-message-body"]')!;
  const parent = body.parentElement!;
  body.remove();
  parent.append(notice());
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('messageFromLabel', () => {
  it('takes what follows the first ": "', () => {
    expect(messageFromLabel('bob: hi: there')).toBe('hi: there');
    expect(messageFromLabel('nothing')).toBeNull();
    expect(messageFromLabel(null)).toBeNull();
  });
});

describe('deleted messages', () => {
  let registry: EmoteRegistry;
  let chat: ChatObserver;
  let container: HTMLElement;

  beforeEach(() => {
    registry = new EmoteRegistry();
    registry.setSets([{ provider: '7tv', scope: 'channel', emotes: [KEKW] }]);
    document.body.innerHTML = `<div data-test-selector="chat-scrollable-area__message-container"></div>`;
    container = document.body.firstElementChild as HTMLElement;
  });

  afterEach(() => chat?.stop());

  it('puts the deleted body back before the notice, our emotes included', async () => {
    chat = new ChatObserver(registry);
    chat.start();
    container.insertAdjacentHTML('beforeend', line('bob', 'lol KEKW'));
    await flush();

    deleteMessage(container.querySelector('.chat-line__message')!);
    await flush();

    const copy = container.querySelector('.twitchy-deleted')!;
    expect(copy.nextElementSibling?.matches('[data-a-target="chat-deleted-message-placeholder"]')).toBe(true);
    expect(copy.getAttribute('title')).toBe('message deleted by a moderator.');
    expect(copy.querySelector('.twitchy-fragment')?.textContent).toBe('lol ');
    const img = copy.querySelector('img')!;
    expect(img.alt).toBe('KEKW');
    expect(emoteOfImage.get(img)).toBe(KEKW);
  });

  it('restores each line when several are deleted at once', async () => {
    chat = new ChatObserver(registry);
    chat.start();
    container.insertAdjacentHTML('beforeend', line('bob', 'one') + line('bob', 'two'));
    await flush();

    container.querySelectorAll('.chat-line__message').forEach(deleteMessage);
    await flush();

    expect([...container.querySelectorAll('.twitchy-deleted')].map((c) => c.textContent?.trim())).toEqual([
      'one',
      'two',
    ]);
  });

  it('uses the aria-label for messages deleted before we saw them', () => {
    container.insertAdjacentHTML('beforeend', line('bob', 'old KEKW'));
    deleteMessage(container.querySelector('.chat-line__message')!);

    chat = new ChatObserver(registry);
    chat.start();

    const copy = container.querySelector('.twitchy-deleted')!;
    expect(copy.textContent).toBe('old ');
    expect(copy.querySelector('img')?.alt).toBe('KEKW');
  });

  it('adds one copy per notice', async () => {
    chat = new ChatObserver(registry);
    chat.start();
    container.insertAdjacentHTML('beforeend', line('bob', 'hi'));
    await flush();
    deleteMessage(container.querySelector('.chat-line__message')!);
    await flush();
    chat.stop();
    chat = new ChatObserver(registry);
    chat.start();
    expect(container.querySelectorAll('.twitchy-deleted')).toHaveLength(1);
  });
});
