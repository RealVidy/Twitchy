import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Twitchy',
  description: '7TV, BetterTTV and FrankerFaceZ emotes in Twitch chat.',
  version: pkg.version,
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_title: 'Twitchy settings',
    default_popup: 'src/popup/index.html',
  },
  options_ui: {
    page: 'src/popup/index.html',
  },
  content_scripts: [
    {
      matches: ['https://www.twitch.tv/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
    {
      // Reads Twitch's player for the video stats, sets its volume for the mouse wheel, mutes it on a
      // click and while a sidebar preview plays; our isolated content script cannot reach it.
      matches: ['https://www.twitch.tv/*'],
      js: ['src/page/index.ts'],
      run_at: 'document_idle',
      world: 'MAIN',
    },
    {
      // Skips the content warning in the player of our sidebar previews, which is a frame of its own.
      matches: ['https://player.twitch.tv/*'],
      js: ['src/embed/index.ts'],
      run_at: 'document_idle',
      all_frames: true,
    },
  ],
  permissions: ['storage'],
  host_permissions: [
    'https://7tv.io/*',
    'https://api.betterttv.net/*',
    'https://api.frankerfacez.com/*',
    'https://gql.twitch.tv/*',
  ],
});
