import type { EmoteRegistry } from '../emotes/registry';
import { emoteOfImage, renderText } from './render';
import { SEL } from './selectors';

/** Our copy of a deleted message, right before Twitch's notice. CSS shows one or the other. */
export const DELETED_CLASS = 'twitchy-deleted';

/**
 * When a moderator deletes a message, Twitch takes its body out of the chat line and puts a
 * "message deleted" notice in its place. We keep the body it took out until the notice shows up.
 */
const removedBodies = new WeakMap<Element, HTMLElement>();

/** Call for every mutation record, before restoreDeleted. */
export function noteRemovedBody(record: MutationRecord): void {
  const line = record.target instanceof Element ? record.target.closest(SEL.chatLine) : null;
  if (!line) return;
  for (const node of record.removedNodes) {
    if (node instanceof HTMLElement && node.matches(SEL.messageBody)) removedBodies.set(line, node);
  }
}

/** The message in a chat line's aria-label, "name: message", which Twitch keeps after deleting. */
export function messageFromLabel(label: string | null): string | null {
  const i = label?.indexOf(': ') ?? -1;
  return label && i >= 0 ? label.slice(i + 2) : null;
}

/** A copy of the body's contents, with our emotes still known to the tooltip. */
function copyBody(body: HTMLElement): DocumentFragment {
  const clone = body.cloneNode(true) as HTMLElement;
  const originals = body.querySelectorAll('img');
  clone.querySelectorAll('img').forEach((img, i) => {
    const emote = emoteOfImage.get(originals[i]);
    if (emote) emoteOfImage.set(img, emote);
  });
  const frag = document.createDocumentFragment();
  frag.append(...clone.childNodes);
  return frag;
}

/** Puts the text of every deleted message under `root` back, before Twitch's notice. */
export function restoreDeleted(root: Element, registry: EmoteRegistry): void {
  const notices = root.matches(SEL.deletedNotice) ? [root] : root.querySelectorAll(SEL.deletedNotice);
  for (const notice of notices) {
    if (notice.previousElementSibling?.classList.contains(DELETED_CLASS)) continue;
    const line = notice.closest(SEL.chatLine);
    if (!line) continue;

    const copy = document.createElement('span');
    copy.className = DELETED_CLASS;
    copy.title = notice.textContent ?? '';
    const body = removedBodies.get(line);
    if (body) {
      copy.append(copyBody(body));
    } else {
      // Deleted before we saw it, e.g. in the history Twitch loads with the chat.
      const text = messageFromLabel(line.getAttribute('aria-label'));
      if (!text) continue;
      copy.append(renderText(text, registry));
    }
    notice.before(copy);
  }
}
