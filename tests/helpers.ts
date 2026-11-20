import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Records the listeners an install adds to the document, <html> and window and takes them away
 * after each test, so the code installed by earlier tests no longer reacts.
 */
export function isolateListeners(): void {
  const added: [EventTarget, string, EventListenerOrEventListenerObject, boolean][] = [];
  beforeEach(() => {
    for (const target of [document, document.documentElement, window] as EventTarget[]) {
      const original = target.addEventListener.bind(target);
      vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
        if (listener) added.push([target, type, listener, capture(options)]);
        original(type, listener, options);
      });
    }
  });
  afterEach(() => {
    for (const [target, type, listener, useCapture] of added.splice(0)) {
      target.removeEventListener(type, listener, useCapture);
    }
    vi.restoreAllMocks();
  });
}

function capture(options: boolean | AddEventListenerOptions | undefined): boolean {
  return typeof options === 'boolean' ? options : !!options?.capture;
}
