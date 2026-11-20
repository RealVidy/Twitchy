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
  ],
  permissions: ['storage'],
  host_permissions: [
    'https://7tv.io/*',
    'https://api.betterttv.net/*',
    'https://api.frankerfacez.com/*',
    'https://gql.twitch.tv/*',
  ],
});
