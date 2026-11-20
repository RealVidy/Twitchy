import { beforeEach, describe, expect, it } from 'vitest';
import { buildSections, EmotePicker, markLockedSections } from '../src/content/emote-picker';
import { EmoteRegistry } from '../src/emotes/registry';
import type { Emote, Provider, Scope } from '../src/providers/types';
import { DEFAULT_SETTINGS, type Settings } from '../src/shared/settings';

function emote(name: string, provider: Provider = '7tv', scope: Scope = 'channel'): Emote {
  return {
    id: name,
    name,
    provider,
    scope,
    images: [{ scale: 1, url: `https://cdn.example/${name}.webp` }],
    animated: false,
    zeroWidth: false,
  };
}

const names = (s: { emotes: Emote[] }) => s.emotes.map((e) => e.name);

describe('buildSections', () => {
  const emotes = [
    emote('catJAM'),
    emote('KEKW'),
    emote('OMEGALUL', '7tv', 'global'),
    emote('Clap', 'bttv', 'global'),
    emote('monkaS', 'bttv'),
    emote('LULW', 'ffz'),
  ];
  const counts: Record<string, number> = { KEKW: 5, OMEGALUL: 9, Clap: 1 };
  const uses = (n: string) => counts[n] ?? 0;

  it('groups by provider, most used first, then channel before global, then by name', () => {
    const sections = buildSections(emotes, '', 60, uses);
    expect(sections.map((s) => s.provider)).toEqual(['7tv', 'bttv', 'ffz']);
    expect(names(sections[0])).toEqual(['OMEGALUL', 'KEKW', 'catJAM']);
    expect(names(sections[1])).toEqual(['Clap', 'monkaS']);
  });

  it('keeps only the most used when a provider has more than the limit', () => {
    const [seventv] = buildSections(emotes, '', 2, uses);
    expect(names(seventv)).toEqual(['OMEGALUL', 'KEKW']);
    expect(seventv.total).toBe(3);
  });

  it('searches every emote, not only the most used, names starting with the query first', () => {
    const sections = buildSections(emotes, 'lul', 1, uses);
    expect(sections.map((s) => [s.provider, names(s), s.total])).toEqual([
      ['7tv', ['OMEGALUL'], 1],
      ['ffz', ['LULW'], 1],
    ]);
    expect(names(buildSections([emote('OMEGALUL'), emote('LULW')], 'lul', 9, () => 0)[0])).toEqual(
      ['LULW', 'OMEGALUL'],
    );
  });
});

/** The parts of Twitch's emote picker we rely on, as seen on twitch.tv. */
function pickerHtml(search = ''): string {
  const item = (name: string, locked: boolean) =>
    `<div><div class="emote-button" data-a-target="${name}"><button><img alt="${name}"></button>${
      locked ? '<div data-test-selector="badge-button-lock"></div>' : ''
    }</div></div>`;
  const section = (title: string, items: string, cls = '') =>
    `<div class="${cls}"><div><div class="emote-grid-section__header-title"><img alt="${title}"><strong>${title}</strong></div></div><div><div class="emote-grid">${items}</div></div></div>`;
  return `
    <div data-a-target="emote-picker"><div class="emote-picker">
      <input type="search" value="${search}">
      <div class="emote-picker__tab-content emote-picker__scroll-container"><div class="list">
        <div class="power-ups"></div>
        ${section('Frequently Used', item('Kappa', false), 'emote-picker__content-block')}
        ${section('xQc', item('xqcL', true) + item('xqcLL', true), 'channel')}
        ${section('Global', item('LUL', false) + item('SubOnly', true), 'global')}
      </div></div>
      <div class="emote-picker__nav-content">
        <div class="nav"><button><img alt="xQc"></button></div>
        <div class="nav"><button><img alt="Someone"></button></div>
      </div>
    </div></div>`;
}

describe('markLockedSections', () => {
  it('marks sections where every emote is locked, and their side bar button', () => {
    document.body.innerHTML = pickerHtml();
    markLockedSections(document.querySelector('[data-a-target="emote-picker"]')!);
    expect(document.querySelector('.channel')!.classList).toContain('twitchy-locked-section');
    expect(document.querySelector('.global')!.classList).not.toContain('twitchy-locked-section');
    const navs = [...document.querySelectorAll('.nav button')];
    expect(navs.map((b) => b.classList.contains('twitchy-locked-nav'))).toEqual([true, false]);
  });

  it('unmarks a section once one of its emotes is unlocked', () => {
    document.body.innerHTML = pickerHtml();
    const picker = document.querySelector('[data-a-target="emote-picker"]')!;
    markLockedSections(picker);
    document.querySelector('.channel [data-test-selector="badge-button-lock"]')!.remove();
    markLockedSections(picker);
    expect(document.querySelector('.channel')!.classList).not.toContain('twitchy-locked-section');
  });

  it('never marks the whole list in search results', () => {
    document.body.innerHTML = `<div data-a-target="emote-picker"><div class="emote-picker__tab-content">
      <div class="emote-picker__content-block"><strong>Results</strong>
      <div class="emote-grid"><div><div data-test-selector="badge-button-lock"></div></div></div></div></div></div>`;
    markLockedSections(document.querySelector('[data-a-target="emote-picker"]')!);
    expect(document.querySelector('.emote-picker__tab-content')!.classList).not.toContain(
      'twitchy-locked-section',
    );
    expect(document.querySelector('.emote-picker__content-block')!.classList).toContain(
      'twitchy-locked-section',
    );
  });
});

describe('EmotePicker', () => {
  let settings: Settings;
  let registry: EmoteRegistry;
  let picker: EmotePicker;

  beforeEach(() => {
    settings = { ...DEFAULT_SETTINGS };
    registry = new EmoteRegistry();
    registry.setSets([
      { provider: '7tv', scope: 'channel', emotes: [emote('catJAM'), emote('KEKW')] },
      { provider: 'bttv', scope: 'global', emotes: [emote('Clap', 'bttv', 'global')] },
    ]);
    picker = new EmotePicker(registry, () => 0, () => settings);
  });

  const sectionTitles = () =>
    [...document.querySelectorAll('.twitchy-picker__header strong')].map((s) => s.textContent);

  it('adds a section per provider right after Frequently Used', () => {
    document.body.innerHTML = pickerHtml();
    picker.sync();
    const ours = document.querySelector('.twitchy-picker')!;
    expect(ours.previousElementSibling!.classList).toContain('emote-picker__content-block');
    expect(sectionTitles()).toEqual(['7TV', 'BetterTTV']);
    expect([...ours.querySelectorAll('button')].map((b) => b.dataset.name)).toEqual([
      'catJAM',
      'KEKW',
      'Clap',
    ]);
  });

  it('does not rebuild when nothing changed', () => {
    document.body.innerHTML = pickerHtml();
    picker.sync();
    const first = document.querySelector('.twitchy-picker');
    picker.sync();
    expect(document.querySelector('.twitchy-picker')).toBe(first);
    expect(document.querySelectorAll('.twitchy-picker')).toHaveLength(1);
  });

  it('puts the sections back when Twitch re-renders the picker', () => {
    document.body.innerHTML = pickerHtml();
    picker.sync();
    document.body.innerHTML = pickerHtml();
    picker.sync();
    expect(document.querySelectorAll('.twitchy-picker')).toHaveLength(1);
  });

  it('shows matching emotes after the search results and hides Twitch saying there are none', () => {
    document.body.innerHTML = `<div data-a-target="emote-picker"><input type="search" value="kek">
      <div class="emote-picker__tab-content"><div class="emote-picker__content-block">
      <strong>No Search Results</strong><div class="emote-grid"></div></div></div></div>`;
    picker.sync();
    const content = document.querySelector('.emote-picker__tab-content')!;
    expect(content.lastElementChild!.className).toBe('twitchy-picker');
    const found = [...content.querySelectorAll<HTMLElement>('.twitchy-picker button')];
    expect(found.map((b) => b.dataset.name)).toEqual(['KEKW']);
    expect(content.querySelector('.emote-picker__content-block')!.classList).toContain(
      'twitchy-empty-results',
    );
  });

  it('removes its sections when turned off in the settings', () => {
    document.body.innerHTML = pickerHtml();
    picker.sync();
    settings = { ...settings, pickerEmotes: false };
    picker.refresh();
    picker.sync();
    expect(document.querySelector('.twitchy-picker')).toBeNull();
  });

  it('notes when a provider shows only its most used emotes', () => {
    settings = { ...settings, pickerLimit: 1 };
    document.body.innerHTML = pickerHtml();
    picker.sync();
    expect(document.querySelector('.twitchy-picker__note')!.textContent).toBe('1 most used of 2');
  });
});
