import type { EmoteRegistry } from '../emotes/registry';
import type { Emote } from '../providers/types';
import { chatInput, replaceBeforeCaret } from './chat-input';
import { SEL } from './selectors';
import { PROVIDER_LABEL } from './tooltip';

/** How many of our emotes the list shows at most; Twitch's own matches come after them. */
const MAX_OURS = 25;
const GAP = 4;

export interface Suggestion {
  name: string;
  /** For the <img>: our emote's images, or the srcset Twitch gave its own emote. */
  src: string;
  srcset: string;
  label: string;
}

/** What follows the `:` when the word before the caret is `:` and at least two more characters. */
export function colonQuery(textBeforeCaret: string): string | null {
  return textBeforeCaret.match(/(?:^|\s):([^\s:]{2,})$/)?.[1] ?? null;
}

/**
 * Names containing `query`, ignoring case: names that start with it first, then the others.
 * Within each group the emotes this chat uses most come first, then the registry's order.
 */
export function rankMatches(
  names: readonly string[],
  query: string,
  count: (name: string) => number,
  limit = MAX_OURS,
): string[] {
  const q = query.toLowerCase();
  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of names) {
    const i = name.toLowerCase().indexOf(q);
    if (i === 0) starts.push(name);
    else if (i > 0) contains.push(name);
  }
  // Array.prototype.sort is stable, so equal counts keep the registry's alphabetical order.
  const byUse = (a: string, b: string) => count(b) - count(a);
  return [...starts.sort(byUse), ...contains.sort(byUse)].slice(0, limit);
}

/** Ours first, then Twitch's. A name Twitch also lists is Twitch's: chat shows its emote. */
export function mergeSuggestions(ours: Suggestion[], twitch: Suggestion[]): Suggestion[] {
  const taken = new Set(twitch.map((s) => s.name));
  return [...ours.filter((s) => !taken.has(s.name)), ...twitch];
}

function fromEmote(emote: Emote): Suggestion {
  return {
    name: emote.name,
    src: emote.images[0].url,
    srcset: emote.images.map((i) => `${i.url} ${i.scale}x`).join(', '),
    label: `${PROVIDER_LABEL[emote.provider]} · ${emote.scope === 'channel' ? 'Channel' : 'Global'}`,
  };
}

/** The suggestions in Twitch's own list, which we keep in the page but hide behind ours. */
export function twitchSuggestions(root: ParentNode = document): Suggestion[] {
  return [...root.querySelectorAll<HTMLElement>(`${SEL.autocompleteList} ${SEL.autocompleteItem}`)].flatMap(
    (button) => {
      const name = button.dataset.aTarget;
      const img = button.querySelector('img');
      if (!name || !img) return [];
      return [{ name, src: img.src, srcset: img.srcset, label: 'Twitch' }];
    },
  );
}

/** The `:word` right before a collapsed caret in the chat box, and what follows the colon. */
function colonWordBeforeCaret(): { word: string; query: string } | null {
  const sel = window.getSelection();
  const node = sel?.anchorNode;
  const editor = chatInput();
  if (!sel?.isCollapsed || !(node instanceof Text) || !editor?.contains(node)) return null;
  const before = node.data.slice(0, sel.anchorOffset).replace(/﻿/g, '');
  const query = colonQuery(before);
  return query ? { word: `:${query}`, query } : null;
}

/**
 * A list of emotes matching what you type after a `:`, in place of Twitch's own list, which
 * only knows Twitch emotes. Twitch's matches are still there, after ours.
 */
export class ColonComplete {
  private el: HTMLDivElement | null = null;
  private items: Suggestion[] = [];
  private index = 0;
  private word: string | null = null;
  /** Escape closes the list until the word changes. */
  private dismissed: string | null = null;
  private watched: Element | null = null;
  private observer = new MutationObserver(() => this.schedule());
  private frame = 0;

  constructor(
    private registry: EmoteRegistry,
    private count: (name: string) => number,
    private enabled: () => boolean,
  ) {}

  start(): void {
    document.addEventListener('selectionchange', () => this.schedule());
    document.addEventListener('focusin', () => this.schedule());
    window.addEventListener('resize', () => this.isOpen && this.place());
    this.registry.onChange(() => this.schedule());
  }

  get isOpen(): boolean {
    return this.items.length > 0;
  }

  /** Handles a keydown in the chat box while the list is open. True when it was ours. */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.isOpen || e.ctrlKey || e.altKey || e.metaKey) return false;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        const step = e.key === 'ArrowDown' ? 1 : -1;
        this.select((this.index + step + this.items.length) % this.items.length);
        break;
      }
      case 'Tab':
      case 'Enter':
        if (e.shiftKey && e.key === 'Enter') return false;
        this.choose(this.index);
        break;
      case 'Escape':
        // Not stopped: Twitch closes its own (hidden) list too.
        this.dismissed = this.word;
        this.close();
        return false;
      default:
        return false;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    return true;
  }

  /** Re-reads the chat box on the next frame; typing fires several events per key. */
  schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
  }

  private update(): void {
    this.watch();
    const found = this.enabled() ? colonWordBeforeCaret() : null;
    if (!found || found.word === this.dismissed) {
      if (found?.word !== this.dismissed) this.dismissed = null;
      return this.close();
    }
    this.dismissed = null;

    const ours = rankMatches(this.registry.names(), found.query, this.count).flatMap((name) => {
      const emote = this.registry.get(name);
      return emote ? [fromEmote(emote)] : [];
    });
    const items = mergeSuggestions(ours, twitchSuggestions());
    if (!items.length) return this.close();

    const selected = this.word === found.word ? this.items[this.index]?.name : undefined;
    this.word = found.word;
    this.items = items;
    this.index = Math.max(0, items.findIndex((s) => s.name === selected));
    this.render();
  }

  /** Twitch's list shows up a moment after a key press: watch the chat box to pick it up. */
  private watch(): void {
    const container = chatInput()?.closest(SEL.chatInputContainer) ?? null;
    if (container === this.watched) return;
    this.observer.disconnect();
    this.watched = container;
    if (container) this.observer.observe(container, { childList: true, subtree: true, characterData: true });
  }

  private choose(index: number): void {
    const item = this.items[index];
    const word = this.word;
    this.close();
    if (item && word) replaceBeforeCaret(word, `${item.name} `);
  }

  private select(index: number): void {
    this.index = index;
    this.el?.querySelectorAll('.twitchy-colon__item').forEach((el, i) => {
      el.classList.toggle('twitchy-colon__item--selected', i === index);
      el.setAttribute('aria-selected', String(i === index));
      if (i === index) el.scrollIntoView({ block: 'nearest' });
    });
  }

  private render(): void {
    if (!this.el?.isConnected) {
      this.el = document.createElement('div');
      this.el.className = 'twitchy-colon';
      this.el.setAttribute('role', 'listbox');
      document.body.append(this.el);
    }
    this.el.replaceChildren(
      ...this.items.map((item, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'twitchy-colon__item';
        button.setAttribute('role', 'option');
        // Keeps the caret in the chat box, which choose() needs.
        button.addEventListener('mousedown', (e) => e.preventDefault());
        button.addEventListener('click', () => this.choose(i));

        const img = document.createElement('img');
        img.className = 'twitchy-colon__image';
        img.src = item.src;
        img.srcset = item.srcset;
        img.alt = '';
        const name = document.createElement('span');
        name.className = 'twitchy-colon__name';
        name.textContent = item.name;
        const label = document.createElement('span');
        label.className = 'twitchy-colon__label';
        label.textContent = item.label;
        button.append(img, name, label);
        return button;
      }),
    );
    document.documentElement.classList.add('twitchy-colon-open');
    this.place();
    this.select(this.index);
  }

  /** Sits right above the chat box, as wide as Twitch's own list. */
  private place(): void {
    const box = chatInput()?.closest(SEL.chatInputContainer);
    if (!this.el || !box) return;
    const r = box.getBoundingClientRect();
    const inset = 10;
    this.el.style.left = `${r.left + inset}px`;
    this.el.style.width = `${r.width - inset * 2}px`;
    this.el.style.bottom = `${window.innerHeight - r.top + GAP}px`;
    this.el.style.maxHeight = `${Math.max(120, Math.min(r.top - 2 * GAP, 400))}px`;
  }

  private close(): void {
    this.items = [];
    this.word = null;
    this.el?.remove();
    this.el = null;
    document.documentElement.classList.remove('twitchy-colon-open');
  }
}
