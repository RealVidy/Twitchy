import type { EmoteRegistry } from '../emotes/registry';
import type { Emote, Provider } from '../providers/types';
import type { Settings } from '../shared/settings';
import { insertIntoChat } from './chat-input';
import { createEmoteImage } from './render';
import { SEL } from './selectors';
import { PROVIDER_LABEL } from './tooltip';

const PROVIDERS: Provider[] = ['7tv', 'bttv', 'ffz'];

export interface PickerSection {
  provider: Provider;
  /** The emotes to show, most used first. */
  emotes: Emote[];
  /** How many emotes the provider has (that match the search). */
  total: number;
}

/**
 * Groups emotes by provider, most used in this channel's chat first, then channel emotes before
 * global ones. A provider with more than `limit` emotes only gets its `limit` most used. When
 * searching, names starting with the query come before names that only contain it.
 */
export function buildSections(
  emotes: readonly Emote[],
  query: string,
  limit: number,
  uses: (name: string) => number,
): PickerSection[] {
  const q = query.trim().toLowerCase();
  const matching = q ? emotes.filter((e) => e.name.toLowerCase().includes(q)) : emotes;
  const starts = (e: Emote) => Number(q !== '' && e.name.toLowerCase().startsWith(q));
  const sorted = [...matching].sort(
    (a, b) =>
      starts(b) - starts(a) ||
      uses(b.name) - uses(a.name) ||
      Number(b.scope === 'channel') - Number(a.scope === 'channel') ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
  return PROVIDERS.map((provider) => {
    const all = sorted.filter((e) => e.provider === provider);
    return { provider, emotes: all.slice(0, limit), total: all.length };
  }).filter((s) => s.total > 0);
}

/**
 * Marks picker sections (and their buttons in the side bar) where every emote is locked, so
 * CSS can hide them. Single locked emotes are hidden by CSS alone.
 */
export function markLockedSections(picker: Element): void {
  const lockedTitles = new Set<string>();
  for (const grid of picker.querySelectorAll(SEL.pickerGrid)) {
    const section = grid.closest(SEL.pickerBlock) ?? grid.parentElement?.parentElement;
    if (!section || section.matches(SEL.pickerContent) || !picker.contains(section)) continue;
    const items = [...grid.children];
    const locked = items.length > 0 && items.every((i) => i.querySelector(SEL.emoteLock));
    section.classList.toggle('twitchy-locked-section', locked);
    const title = section.querySelector(SEL.pickerSectionTitle)?.textContent?.trim();
    if (locked && title) lockedTitles.add(title);
  }
  for (const button of picker.querySelectorAll(SEL.pickerNavButton)) {
    const name = button.querySelector('img')?.alt;
    button.classList.toggle('twitchy-locked-nav', Boolean(name && lockedTitles.has(name)));
  }
}

function renderSections(sections: PickerSection[], searching: boolean): HTMLElement {
  const root = document.createElement('div');
  root.className = 'twitchy-picker';
  for (const s of sections) {
    const section = document.createElement('div');
    section.className = 'twitchy-picker__section';

    const header = document.createElement('div');
    header.className = 'twitchy-picker__header';
    const title = document.createElement('strong');
    title.textContent = PROVIDER_LABEL[s.provider];
    header.append(title);
    if (s.emotes.length < s.total) {
      const note = document.createElement('span');
      note.className = 'twitchy-picker__note';
      note.textContent = searching
        ? `${s.emotes.length} of ${s.total}`
        : `${s.emotes.length} most used of ${s.total}`;
      note.title = searching ? 'Type more to narrow it down' : 'Search to find the others';
      header.append(note);
    }

    const grid = document.createElement('div');
    grid.className = 'twitchy-picker__grid';
    for (const emote of s.emotes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'twitchy-picker__emote';
      button.setAttribute('aria-label', emote.name);
      button.dataset.name = emote.name;
      const img = createEmoteImage(emote);
      img.loading = 'lazy';
      button.append(img);
      grid.append(button);
    }
    section.append(header, grid);
    root.append(section);
  }

  // Keep the focus where it is (usually the search box) so the picker stays open.
  root.addEventListener('mousedown', (e) => e.preventDefault());
  root.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>('.twitchy-picker__emote');
    if (button?.dataset.name) void insertIntoChat(button.dataset.name);
  });
  return root;
}

type Position = { parent: Element; ref: Element | null; where: 'after' | 'before' | 'append' };

/**
 * Where our sections go: right after "Frequently Used" (or before the first section when there
 * is none), and after Twitch's own results when searching.
 */
function position(content: Element, searching: boolean, ours: Element | null): Position | null {
  if (searching) return { parent: content, ref: null, where: 'append' };
  const list = content.firstElementChild;
  if (!list || list === ours) return null;
  const first = [...list.children].find((c) => c !== ours && c.querySelector(SEL.pickerGrid));
  if (!first) return { parent: list, ref: null, where: 'append' };
  return first.matches(SEL.pickerBlock)
    ? { parent: list, ref: first, where: 'after' }
    : { parent: list, ref: first, where: 'before' };
}

function isPlaced(el: Element, p: Position): boolean {
  if (el.parentElement !== p.parent) return false;
  if (p.where === 'after') return el.previousElementSibling === p.ref;
  if (p.where === 'before') return el.nextElementSibling === p.ref;
  return el.nextElementSibling === null;
}

function place(el: Element, p: Position): void {
  if (p.where === 'after') p.ref!.after(el);
  else if (p.where === 'before') p.ref!.before(el);
  else p.parent.append(el);
}

/**
 * Adds 7TV, BetterTTV and FrankerFaceZ sections to Twitch's emote picker and hides the emotes
 * you have not unlocked. Twitch rebuilds the picker on every search, so we watch the page and
 * put our sections back whenever they are gone.
 */
export class EmotePicker {
  private block: HTMLElement | null = null;
  private key = '';
  private version = 0;
  private scheduled = false;
  private observer = new MutationObserver(() => this.schedule());

  constructor(
    private registry: EmoteRegistry,
    private uses: (name: string) => number,
    private settings: () => Settings,
  ) {
    registry.onChange(() => this.refresh());
  }

  start(): void {
    this.observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener(
      'input',
      (e) => {
        if (e.target instanceof Element && e.target.closest(SEL.emotePicker)) this.schedule();
      },
      true,
    );
    this.schedule();
  }

  /** Rebuilds our sections, e.g. after the emotes or the settings changed. */
  refresh(): void {
    this.version++;
    this.schedule();
  }

  /** Brings the open picker up to date. Does nothing when it already is. */
  sync(): void {
    const picker = document.querySelector(SEL.emotePicker);
    if (!picker) return this.remove();
    markLockedSections(picker);

    const content = picker.querySelector(SEL.pickerContent);
    const query = picker.querySelector<HTMLInputElement>(SEL.pickerSearch)?.value.trim() ?? '';
    const { pickerEmotes, pickerLimit } = this.settings();
    const pos = content && position(content, query !== '', this.block);
    if (!pos || !pickerEmotes || this.registry.size === 0) return this.remove();

    const key = `${this.version}|${pickerLimit}|${query}`;
    // Twitch dropped our sections when it re-rendered the list, or what they show changed.
    if (key !== this.key || (this.block && !this.block.isConnected)) {
      this.block?.remove();
      this.key = key;
      const sections = buildSections(this.registry.emotes(), query, pickerLimit, this.uses);
      this.block = sections.length ? renderSections(sections, query !== '') : null;
    }
    if (this.block && !isPlaced(this.block, pos)) place(this.block, pos);

    // Twitch says "No Search Results" when only our emotes match; hide that then.
    content!.querySelectorAll(SEL.pickerBlock).forEach((b) => {
      const grid = b.querySelector(SEL.pickerGrid);
      const empty = Boolean(query && this.block && grid && grid.childElementCount === 0);
      b.classList.toggle('twitchy-empty-results', empty);
    });
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.sync();
    });
  }

  private remove(): void {
    this.block?.remove();
    this.block = null;
    this.key = '';
  }
}
