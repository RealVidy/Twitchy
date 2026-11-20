import { installAutoClicker } from './auto-click';
import { SEL } from './selectors';

/** The "Claim Bonus" button Twitch shows by the points balance every 15 minutes or so. */
export function findBonusButton(root: ParentNode = document): HTMLButtonElement | null {
  return root.querySelector(`${SEL.pointsSummary} ${SEL.claimBonusIcon}`)?.closest('button') ?? null;
}

/** Clicks the channel points bonus as soon as Twitch shows it, like BTTV and 7TV do. */
export function installBonusClaimer(enabled: () => boolean): { check: () => void } {
  return installAutoClicker(() => findBonusButton(), enabled);
}
