import { installAutoClicker } from './auto-click';
import { SEL } from './selectors';

/** The "Start Watching" button on the warning Twitch puts over streams with content labels. */
export function findContentGateButton(root: ParentNode = document): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(SEL.contentGateButton);
}

/** Starts the stream behind Twitch's content warning ("Just one second..."), like 7TV does. */
export function installContentGateSkipper(enabled: () => boolean): { check: () => void } {
  return installAutoClicker(() => findContentGateButton(), enabled);
}
