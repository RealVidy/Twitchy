import { SEL } from './selectors';

/**
 * Buttons we hide with Twitch's chat header but still want: cloned into the row under the chat
 * input. The clones look like Twitch's own and click the hidden originals.
 */
const CHAT_TOOLS = [
  { key: 'community', source: SEL.communityButton },
  { key: 'collapse', source: SEL.collapseChatButton },
] as const;

function cloneButton(source: HTMLElement, sourceSelector: string, key: string): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.removeAttribute('data-a-target');
  clone.removeAttribute('data-test-selector');
  clone.dataset.twitchyTool = key;
  const label = source.getAttribute('aria-label');
  if (label) clone.title = label;
  clone.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.querySelector<HTMLElement>(sourceSelector)?.click();
  });
  return clone;
}

/** Keeps our copies of the community and collapse buttons next to the chat settings gear. */
export function syncChatTools(root: ParentNode = document): void {
  const settings = root.querySelector(SEL.chatSettingsButton);
  const row = settings?.closest(SEL.chatButtons);
  if (!settings || !row) return;

  // The child of the gear's group that holds the gear: we go right before it.
  let anchor: Element = settings;
  while (anchor.parentElement && anchor.parentElement.parentElement !== row) anchor = anchor.parentElement;
  const group = anchor.parentElement;
  if (!group) return;

  let tools = row.querySelector<HTMLElement>('.twitchy-chat-tools');
  if (!tools) {
    tools = document.createElement('div');
    tools.className = 'twitchy-chat-tools';
  }
  if (tools.parentElement !== group || tools.nextElementSibling !== anchor) group.insertBefore(tools, anchor);

  for (const { key, source } of CHAT_TOOLS) {
    const original = root.querySelector<HTMLElement>(source);
    const copy = tools.querySelector<HTMLElement>(`[data-twitchy-tool="${key}"]`);
    if (!original) {
      copy?.remove();
    } else if (!copy) {
      const clone = cloneButton(original, source, key);
      // Keep the order of CHAT_TOOLS whatever order the originals appear in.
      const after = CHAT_TOOLS.slice(CHAT_TOOLS.findIndex((t) => t.key === key) + 1)
        .map((t) => tools.querySelector(`[data-twitchy-tool="${t.key}"]`))
        .find(Boolean);
      tools.insertBefore(clone, after ?? null);
    }
  }
}

/** The top bar's slot (direct child of the right-hand button row) that holds `el`. */
function topNavSlot(el: Element | null): Element | null {
  const userMenu = document.querySelector(SEL.userMenuToggle);
  if (!el || !userMenu) return null;
  let slot = el;
  while (slot.parentElement && !slot.parentElement.contains(userMenu)) slot = slot.parentElement;
  return slot.parentElement ? slot : null;
}

/** Tags the parts of Twitch that styles.css hides or moves but that have no stable class. */
export function markLayout(): void {
  topNavSlot(document.querySelector(SEL.whispersButton))?.classList.add('twitchy-whispers');
  syncChatTools();
}

/** Watches Twitch's page and keeps the tidied-up layout in place as it re-renders. */
export function installLayout(): void {
  document.documentElement.classList.add('twitchy-tidy');
  let queued = false;
  const run = () => {
    queued = false;
    markLayout();
  };
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  }).observe(document.body, { childList: true, subtree: true });
  run();
}
