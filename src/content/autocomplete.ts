import type { EmoteRegistry } from '../emotes/registry';
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

/** The word right before a collapsed caret, with the text node and offsets it sits in. */
function wordBeforeCaret(): { node: Text; start: number; end: number; word: string } | null {
  const sel = window.getSelection();
  const node = sel?.anchorNode;
  if (!sel?.isCollapsed || !(node instanceof Text)) return null;
  const end = sel.anchorOffset;
  const word = node.data.slice(0, end).match(/\S+$/)?.[0];
  // @mentions belong to Twitch's own username completion.
  if (!word || word.startsWith('@')) return null;
  return { node, start: end - word.length, end, word };
}

/**
 * Twitch's chat box is a Slate editor that keeps its own copy of the text. Selecting the word
 * and inserting through execCommand fires the `beforeinput` event Slate listens to, so its
 * state stays in sync with what is shown.
 */
function replace(node: Text, start: number, end: number, text: string): void {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand('insertText', false, text);
}

export function installAutocomplete(registry: EmoteRegistry): void {
  const completer = new Completer(() => registry.names());
  registry.onChange(() => completer.reset());

  // Capture phase on the document runs before Twitch's own key handlers on the editor.
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Tab') {
        if (e.key !== 'Shift') completer.reset();
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (!(e.target instanceof Element) || !e.target.closest(SEL.chatInput)) return;

      const at = wordBeforeCaret();
      if (!at) return;
      const name = completer.next(at.word, e.shiftKey);
      if (!name) return; // nothing of ours matches: let Twitch handle Tab

      e.preventDefault();
      e.stopImmediatePropagation();
      replace(at.node, at.start, at.end, name);
    },
    true,
  );
}
