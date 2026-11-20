import type { EmoteRegistry } from '../emotes/registry';
import { replaceBeforeCaret } from './chat-input';
import type { ColonComplete } from './colon-complete';
import { SEL } from './selectors';

/** Emote names starting with `prefix`, ignoring case, in the registry's sorted order. */
export function completions(names: readonly string[], prefix: string): string[] {
  const p = prefix.toLowerCase();
  return names.filter((n) => n.toLowerCase().startsWith(p));
}

interface Cycle {
  matches: string[];
  index: number;
  /** The name we inserted last; pressing Tab again right after it moves to the next match. */
  inserted: string;
}

/**
 * Works out what Tab should insert for the word before the caret. Pressing Tab again right
 * after a completion moves to the next match (Shift+Tab to the previous one).
 */
export class Completer {
  private cycle: Cycle | null = null;

  constructor(private names: () => readonly string[]) {}

  next(word: string, backwards: boolean): string | null {
    if (this.cycle && word === this.cycle.inserted) {
      const { matches } = this.cycle;
      const step = backwards ? -1 : 1;
      this.cycle.index = (this.cycle.index + step + matches.length) % matches.length;
      return (this.cycle.inserted = matches[this.cycle.index]);
    }

    const matches = completions(this.names(), word);
    if (!matches.length) {
      this.cycle = null;
      return null;
    }
    const index = backwards ? matches.length - 1 : 0;
    this.cycle = { matches, index, inserted: matches[index] };
    return matches[index];
  }

  reset(): void {
    this.cycle = null;
  }
}

/** The word right before a collapsed caret. */
function wordBeforeCaret(): string | null {
  const sel = window.getSelection();
  const node = sel?.anchorNode;
  if (!sel?.isCollapsed || !(node instanceof Text)) return null;
  const end = sel.anchorOffset;
  const word = node.data.slice(0, end).match(/\S+$/)?.[0];
  // @mentions belong to Twitch's own username completion, and :words to the colon list.
  if (!word || word.startsWith('@') || word.startsWith(':')) return null;
  return word;
}

/** Tab-completion, and the `:` list's keys, which win while that list is open. */
export function installAutocomplete(registry: EmoteRegistry, colon: ColonComplete): void {
  const completer = new Completer(() => registry.names());
  registry.onChange(() => completer.reset());

  // Capture phase on the window, added at startup, runs before Twitch's own key handlers: its
  // suggestion list stops arrow keys, Tab and Enter in a window capture listener it adds
  // when the list opens.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.target instanceof Element && e.target.closest(SEL.chatInput) && colon.handleKey(e)) {
        completer.reset();
        return;
      }
      if (e.key !== 'Tab') {
        if (e.key !== 'Shift') completer.reset();
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (!(e.target instanceof Element) || !e.target.closest(SEL.chatInput)) return;

      const word = wordBeforeCaret();
      if (!word) return;
      const name = completer.next(word, e.shiftKey);
      if (!name) return; // nothing of ours matches: let Twitch handle Tab

      e.preventDefault();
      e.stopImmediatePropagation();
      replaceBeforeCaret(word, name);
    },
    true,
  );
}
