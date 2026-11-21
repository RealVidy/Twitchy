/**
 * True in a player that a twitch.tv page puts in its own frame, such as our sidebar preview.
 * Other sites embedding Twitch's player are left alone.
 */
export function embeddedInTwitch(ancestors: ArrayLike<string> | undefined = location.ancestorOrigins): boolean {
  return ancestors?.[0] === 'https://www.twitch.tv';
}

/** The name of our sidebar preview's frame, which the player inside reads as `window.name`. */
export const PREVIEW_FRAME_NAME = 'twitchy-side-preview';

const VIDEO_ONLY = 'twitchy-video-only';

/**
 * Hides everything in the player but the video: the content labels ("Includes Paid Promotion",
 * "Intended for certain audiences"), the title bar and any other overlay. Hidden buttons can still
 * be clicked from a script, so the content warning skipper keeps working.
 */
export function showVideoOnly(doc: Document = document): void {
  if (doc.getElementById(VIDEO_ONLY)) return;
  const style = doc.createElement('style');
  style.id = VIDEO_ONLY;
  // Visibility is inherited, and a child can turn it back on: only the video is drawn.
  style.textContent = `
    body * { visibility: hidden !important; }
    video { visibility: visible !important; }
  `;
  (doc.head ?? doc.documentElement).append(style);
}
