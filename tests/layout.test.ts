import { describe, expect, it, vi } from 'vitest';
import { syncChatTools } from '../src/content/layout';

function twitchChat(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `
    <div class="stream-chat-header">
      <button aria-label="Community" data-test-selector="chat-viewer-list"><svg></svg></button>
    </div>
    <div class="right-column__toggle-visibility">
      <button aria-label="Collapse Chat" data-a-target="right-column__toggle-collapse-btn"><svg></svg></button>
    </div>
    <div data-test-selector="chat-input-buttons-container">
      <div class="points"></div>
      <div class="group">
        <p></p>
        <div class="gear-wrap"><div><button data-a-target="chat-settings" aria-label="Chat settings"></button></div></div>
      </div>
      <div class="send"><button>Chat</button></div>
    </div>`;
  document.body.replaceChildren(root);
  return root;
}

describe('syncChatTools', () => {
  it('puts copies of the community and collapse buttons right before the chat settings gear', () => {
    const root = twitchChat();
    syncChatTools(root);
    syncChatTools(root); // a second pass changes nothing

    const group = root.querySelector('.group')!;
    const tools = group.querySelector('.twitchy-chat-tools')!;
    expect(tools.nextElementSibling).toBe(group.querySelector('.gear-wrap'));
    const copies = [...tools.querySelectorAll('button')];
    expect(copies.map((b) => b.getAttribute('aria-label'))).toEqual(['Community', 'Collapse Chat']);
    expect(copies.every((b) => !b.hasAttribute('data-a-target') && !b.hasAttribute('data-test-selector'))).toBe(true);
  });

  it('clicks the original button', () => {
    const root = twitchChat();
    syncChatTools(root);
    const original = root.querySelector<HTMLElement>('[data-test-selector="chat-viewer-list"]')!;
    const click = vi.fn();
    original.addEventListener('click', click);
    root.querySelector<HTMLElement>('[data-twitchy-tool="community"]')!.click();
    expect(click).toHaveBeenCalledOnce();
  });

  it('drops a copy when its original goes away', () => {
    const root = twitchChat();
    syncChatTools(root);
    root.querySelector('.right-column__toggle-visibility')!.remove();
    syncChatTools(root);
    expect(root.querySelector('[data-twitchy-tool="collapse"]')).toBeNull();
    expect(root.querySelector('[data-twitchy-tool="community"]')).not.toBeNull();
  });
});
