import { chatText, setChatText } from './chat-input';
import { SEL } from './selectors';

export const MAX_ENTRIES = 100;

/**
 * The messages sent from this tab, oldest first, and which one Up and Down have brought back.
 * Up only starts from an empty chat box, and only keeps going while the box still holds the
 * message it brought back, so it never throws away something you typed.
 */
export class MessageHistory {
  private entries: string[] = [];
  /** The entry the chat box shows, or null when it shows your own text. */
  private index: number | null = null;

  record(message: string): void {
    this.index = null;
    const text = message.trim();
    if (!text || this.entries.at(-1) === text) return;
    this.entries.push(text);
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
  }

  /** What Up should put in a box holding `current`, or null to leave the key to the page. */
  older(current: string): string | null {
    if (this.browsing(current)) {
      this.index = Math.max(0, this.index! - 1);
    } else {
      if (current.trim() || !this.entries.length) return null;
      this.index = this.entries.length - 1;
    }
    return this.entries[this.index];
  }

  /** What Down should put in a box holding `current`: newer messages, then an empty box. */
  newer(current: string): string | null {
    if (!this.browsing(current)) return null;
    this.index!++;
    if (this.index! < this.entries.length) return this.entries[this.index!];
    this.index = null;
    return '';
  }

  /** True while the box holds the entry we brought back; editing it ends browsing. */
  private browsing(current: string): boolean {
    if (this.index === null) return false;
    if (current === this.entries[this.index]) return true;
    this.index = null;
    return false;
  }
}

/** Remembers the messages you send and brings them back with Up and Down, like 7TV. */
export function installMessageHistory(enabled: () => boolean): MessageHistory {
  const history = new MessageHistory();
  /** What the box will hold once the last replacement is done; it takes a moment. */
  let target = '';
  let replacing = 0;

  // Capture phase on the window runs before Twitch sends the message and empties the box.
  // Added after the colon list's listener, which stops the keys it uses while it is open.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return;
      if (!(e.target instanceof Element) || !e.target.closest(SEL.chatInput)) return;
      // Twitch's own @mention or :emote list takes Enter and the arrows while it is open.
      if (document.querySelector(SEL.autocompleteList)) return;

      if (e.key === 'Enter') {
        if (!e.shiftKey) history.record(chatText());
        return;
      }
      if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.shiftKey || !enabled()) return;

      const current = replacing ? target : chatText();
      const next = e.key === 'ArrowUp' ? history.older(current) : history.newer(current);
      if (next === null) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      target = next;
      replacing++;
      void setChatText(next).finally(() => replacing--);
    },
    true,
  );

  document.addEventListener(
    'click',
    (e) => {
      if (e.target instanceof Element && e.target.closest(SEL.chatSendButton)) history.record(chatText());
    },
    true,
  );

  return history;
}
