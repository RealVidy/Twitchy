import { SEL } from './selectors';

/** The "Claim Bonus" button Twitch shows by the points balance every 15 minutes or so. */
export function findBonusButton(root: ParentNode = document): HTMLButtonElement | null {
  return root.querySelector(`${SEL.pointsSummary} ${SEL.claimBonusIcon}`)?.closest('button') ?? null;
}

/** Clicks the channel points bonus as soon as Twitch shows it, like BTTV and 7TV do. */
export function installBonusClaimer(enabled: () => boolean): { check: () => void } {
  const clicked = new WeakSet<HTMLButtonElement>();
  const check = () => {
    if (!enabled()) return;
    const button = findBonusButton();
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
