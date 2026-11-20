import { describe, expect, it } from 'vitest';
import { channelFromPath } from '../src/content/channel';

describe('channelFromPath', () => {
  it.each([
    ['/xqc', 'xqc'],
    ['/XQC/', 'xqc'],
    ['/xqc/videos', 'xqc'],
    ['/popout/xqc/chat', 'xqc'],
    ['/embed/xqc/chat', 'xqc'],
    ['/moderator/xqc', 'xqc'],
    ['/', null],
    ['/directory/category/just-chatting', null],
    ['/popout/xqc/viewercard/foo', null],
    ['/settings/profile', null],
  ])('%s -> %s', (path, expected) => {
    expect(channelFromPath(path)).toBe(expected);
  });
});
