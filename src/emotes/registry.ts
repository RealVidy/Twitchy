import type { Emote, EmoteSet, Provider, Scope } from '../providers/types';

/** First match wins when two sets use the same name. */
const PRECEDENCE: [Scope, Provider][] = [
  ['channel', '7tv'],
  ['channel', 'bttv'],
  ['channel', 'ffz'],
  ['global', '7tv'],
  ['global', 'bttv'],
  ['global', 'ffz'],
];

function rank(set: EmoteSet): number {
  const i = PRECEDENCE.findIndex(([s, p]) => s === set.scope && p === set.provider);
  return i === -1 ? PRECEDENCE.length : i;
}

export class EmoteRegistry {
  private sets: EmoteSet[] = [];
  private byName = new Map<string, Emote>();
  private sortedNames: string[] | null = null;
  private listeners = new Set<() => void>();

  setSets(sets: EmoteSet[]): void {
    this.sets = [...sets].sort((a, b) => rank(a) - rank(b));
    this.rebuild();
  }

  /** Replaces the emotes of one set, e.g. after a live 7TV update. */
  replaceSet(provider: Provider, scope: Scope, emotes: Emote[]): void {
    const others = this.sets.filter((s) => !(s.provider === provider && s.scope === scope));
    this.setSets([...others, { provider, scope, emotes }]);
  }

  getSet(provider: Provider, scope: Scope): Emote[] {
    return this.sets.find((s) => s.provider === provider && s.scope === scope)?.emotes ?? [];
  }

  /** Exact, case-sensitive lookup. */
  get(name: string): Emote | undefined {
    return this.byName.get(name);
  }

  get size(): number {
    return this.byName.size;
  }

  /** All usable names, sorted case-insensitively. */
  names(): string[] {
    this.sortedNames ??= [...this.byName.keys()].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
    return this.sortedNames;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private rebuild(): void {
    const map = new Map<string, Emote>();
    for (const set of this.sets) {
      for (const emote of set.emotes) {
        if (!map.has(emote.name)) map.set(emote.name, emote);
      }
    }
    this.byName = map;
    this.sortedNames = null;
    this.listeners.forEach((l) => l());
  }
}
