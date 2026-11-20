import type { EmoteRegistry } from '../emotes/registry';
import { renderAll, renderFragment } from './render';
import { SEL } from './selectors';

/**
 * Watches the chat for new messages. Twitch swaps the chat container when you change channel
 * or open a different panel, so we look for it again every second and move the observer over.
 */
export class ChatObserver {
  private container: Element | null = null;
  private observer = new MutationObserver((records) => this.onMutations(records));
  private timer: number | undefined;

  constructor(private registry: EmoteRegistry) {}

  start(): void {
    this.attach();
    this.timer = window.setInterval(() => this.attach(), 1000);
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.observer.disconnect();
    this.container = null;
  }

  /** Renders messages that arrived before the emotes finished loading. */
  rescan(): void {
    if (this.container) renderAll(this.container, this.registry);
  }

  private attach(): void {
    const found = document.querySelector(SEL.chatContainer);
    if (found === this.container) return;
    this.observer.disconnect();
    this.container = found;
    if (!found) return;
    this.observer.observe(found, { childList: true, subtree: true });
    renderAll(found, this.registry);
  }

  private onMutations(records: MutationRecord[]): void {
    if (this.registry.size === 0) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(SEL.textFragment)) renderFragment(node, this.registry);
        else renderAll(node, this.registry);
      }
    }
  }
}
