import { SEL } from './selectors';

/** Slate keeps a zero-width character in empty lines so the caret has somewhere to go. */
const ZERO_WIDTH = /﻿/g;

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function chatInput(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SEL.chatInput);
}

/**
 * Twitch's chat box is a Slate editor that keeps its own copy of the text and ignores DOM
 * changes it did not make (execCommand does not fire `beforeinput`). So we send it the
 * `beforeinput` events typing would, and Slate edits its text at its own caret, which it
 * first syncs with the page's selection.
 *
 * For a single typed character Slate leaves the edit to the browser, which does nothing for
 * an event we made up; execCommand covers that case.
 *
 * `targetRanges` tells Slate what to edit instead of its caret, for inserting and cutting.
 */
function edit(editor: HTMLElement, inputType: string, data?: string, targetRanges?: StaticRange[]): void {
  const event = new InputEvent('beforeinput', { inputType, data, targetRanges, bubbles: true, cancelable: true });
  editor.dispatchEvent(event);
  if (!event.defaultPrevented && data) document.execCommand('insertText', false, data);
}

function lastTextNode(root: Node): Text | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  while (walker.nextNode()) last = walker.currentNode as Text;
  return last;
}

function firstTextNode(root: Node): Text | null {
  return document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode() as Text | null;
}

/** What the chat box holds. Emotes stay plain text in it, so this is the message as sent. */
export function chatText(editor: HTMLElement | null = chatInput()): string {
  return editor?.textContent?.replace(ZERO_WIDTH, '') ?? '';
}

/** Resolves once the browser reports a selection change, or after a short while if none comes. */
function selectionSettled(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      document.removeEventListener('selectionchange', done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 100);
    document.addEventListener('selectionchange', done);
  });
}

async function insertNow(text: string): Promise<void> {
  const editor = chatInput();
  const sel = window.getSelection();
  if (!editor || !sel) return;

  const inEditor = Boolean(sel.isCollapsed && sel.anchorNode && editor.contains(sel.anchorNode));
  if (!inEditor) {
    editor.focus();
    const last = lastTextNode(editor);
    const range = document.createRange();
    if (last) range.setStart(last, last.length);
    else range.selectNodeContents(editor);
    range.collapse(Boolean(last)); // at the end of the last text, or of the editor
    sel.removeAllRanges();
    sel.addRange(range);
    // Focusing makes Slate move its caret to the start a moment later. Editing before that
    // happens puts this emote at the end but the next one at the start.
    await selectionSettled();
  }

  const node = sel.anchorNode;
  const before = node instanceof Text ? node.data.slice(0, sel.anchorOffset).replace(ZERO_WIDTH, '') : '';
  const space = before && !/\s$/.test(before) ? ' ' : '';
  edit(editor, 'insertText', `${space}${text} `);
}

async function replaceNow(text: string): Promise<void> {
  const editor = chatInput();
  if (!editor || chatText(editor) === text) return;
  const first = firstTextNode(editor);
  const last = lastTextNode(editor);
  if (!first || !last) return;

  editor.focus();
  // Selecting the text first would not do: Slate reads the selection on a delay, and would
  // add to the text at its old caret.
  const all = new StaticRange({ startContainer: first, startOffset: 0, endContainer: last, endOffset: last.length });
  const shown = rendered(editor, text);
  // Slate deletes backward from its own caret, ignoring the range; a cut takes the range.
  edit(editor, text ? 'insertText' : 'deleteByCut', text || undefined, [all]);
  // Slate redraws a moment later with new text nodes. The next replacement needs those.
  await shown;
}

/** Resolves once the chat box shows `text`, or after a short while if it never does. */
function rendered(editor: HTMLElement, text: string): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => chatText(editor) === text && done());
    observer.observe(editor, { childList: true, subtree: true, characterData: true });
    const timer = setTimeout(done, 200);
  });
}

let pending = Promise.resolve();

/**
 * Types `text` into the chat box at the caret, or at the end when the caret is not in it
 * (the emote picker has the focus), with a space on each side like Twitch's own picker.
 * Quick clicks are inserted one after the other, in order.
 */
export function insertIntoChat(text: string): Promise<void> {
  pending = pending.then(() => insertNow(text)).catch((err) => console.warn('[twitchy]', err));
  return pending;
}

/** Replaces everything in the chat box with `text`, leaving the caret at its end. */
export function setChatText(text: string): Promise<void> {
  pending = pending.then(() => replaceNow(text)).catch((err) => console.warn('[twitchy]', err));
  return pending;
}

/** Replaces `word`, which must sit right before the caret in the chat box, with `text`. */
export function replaceBeforeCaret(word: string, text: string): void {
  const editor = chatInput();
  if (!editor) return;
  const count = [...graphemes.segment(word)].length;
  for (let i = 0; i < count; i++) edit(editor, 'deleteContentBackward');
  edit(editor, 'insertText', text);
}
