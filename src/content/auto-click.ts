/**
 * Clicks the button `find` returns as soon as Twitch shows it, once per button.
 * `check` runs it again right away, e.g. when the setting is turned back on.
 */
export function installAutoClicker(
  find: () => HTMLElement | null,
  enabled: () => boolean,
): { check: () => void } {
  const clicked = new WeakSet<HTMLElement>();
  const check = () => {
    if (!enabled()) return;
    const button = find();
    if (!button || clicked.has(button)) return;
    clicked.add(button);
    button.click();
  };

  // A timer rather than requestAnimationFrame, which never fires in a background tab.
  let timer = 0;
  new MutationObserver(() => {
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      check();
    }, 250);
  }).observe(document.body, { childList: true, subtree: true });
  check();
  return { check };
}
