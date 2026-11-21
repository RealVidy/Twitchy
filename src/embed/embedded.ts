/**
 * True in a player that a twitch.tv page puts in its own frame, such as our sidebar preview.
 * Other sites embedding Twitch's player are left alone.
 */
export function embeddedInTwitch(ancestors: ArrayLike<string> | undefined = location.ancestorOrigins): boolean {
  return ancestors?.[0] === 'https://www.twitch.tv';
}
