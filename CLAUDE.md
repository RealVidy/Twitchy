# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Twitchy is a Manifest V3 Chrome extension for twitch.tv: 7TV, BetterTTV and FrankerFaceZ emotes in chat, plus chat, player and sidebar tweaks. It is built with Vite and `@crxjs/vite-plugin`.

## Commands

```sh
npm install
npm run build        # tsc --noEmit, then vite build into dist/
npm run dev          # Vite dev server on port 5173 (strict); load dist/ unpacked, it reloads on change
npm test             # vitest run (jsdom), tests/**/*.test.ts
npm run typecheck    # tsc --noEmit
npx vitest run tests/sidebar.test.ts          # one test file
npx vitest run tests/sidebar.test.ts -t "name" # tests whose name matches
```

To try it, load `dist/` at `chrome://extensions` with **Developer mode** on (**Load unpacked**).

## Versioning

The project uses Semantic Versioning, with releases listed in `CHANGELOG.md` and tagged `vX.Y.Z`. `package.json` is the only place the version is set: `manifest.config.ts` reads it into the manifest. To make a release, add the changelog entry, then run `npm version patch|minor|major`, which bumps the version, commits it and tags it.

Every improvement gets its own release once it's committed, bumped by what it changed:
- **patch** for a bug fix (`fix:` commits).
- **minor** for a new feature or setting (`feat:` commits).
- **major** for a change that breaks something users rely on, such as removing a feature or a setting, or resetting saved settings.

Changes that users don't see (docs, tests, refactors, tooling) don't bump the version.

## Architecture

`manifest.config.ts` declares four execution contexts. Each one can only reach certain things, and that explains most of the code's structure:

- **Background service worker** (`src/background/`): does all cross-origin fetching for the emote providers and Twitch GQL, which content scripts can't do. Content scripts call it through `chrome.runtime.sendMessage` with the typed `Request`/`Response` union in `src/shared/messages.ts`, and replies are `{ ok, data | error }`. `cached()` in `background/cache.ts` keeps results in `chrome.storage.local` under `cache:` keys, so they survive the worker being stopped, and shares one in-flight load per key.
- **Content script, isolated world** (`src/content/index.ts`): the main orchestrator on `www.twitch.tv`. It creates every feature and pushes settings to them through `applySettings`. Twitch is a single-page app and this world can't see its `pushState` calls, so channel changes are detected by polling `location.pathname` every second (`checkLocation` → `switchChannel`).
- **Page script, MAIN world** (`src/page/`): the only context that can reach Twitch's own player object. It reads stats, sets the volume, toggles mute and holds mute during a sidebar preview. The content script talks to it with `window.postMessage`, using the message type constants in `src/shared/player-stats.ts` and `src/shared/volume.ts`. It also writes Twitch's own `localStorage` keys (`volume`, `video-muted`) so changes survive a reload.
- **Embed script** (`src/embed/`): runs in `player.twitch.tv` frames, which is where sidebar previews play. It skips content warnings and, in the preview frame (`PREVIEW_FRAME_NAME`), shows only the video. The content script controls preview volume and mute through Twitch's embed `postMessage` protocol (`EMBED_NAMESPACE` in `content/sidebar.ts`).

The emote pipeline works like this:
- `providers/index.ts` resolves the Twitch id, through Twitch GQL with FFZ as a fallback.
- It then loads the global and channel sets of each provider with `Promise.allSettled`, so one failing provider doesn't hide the others' emotes.
- Each provider module (`providers/seventv.ts`, `bttv.ts`, `ffz.ts`) normalizes its API into the shared `Emote` type from `providers/types.ts`.
- `GetJson` resolves 404 to `null`: a channel with no emotes on a provider isn't an error.
- In the content script, `EmoteRegistry` holds the sets. `ChatObserver` tokenizes and renders new chat lines, and the picker, Tab completion and colon completion all read from the registry.
- 7TV channel sets update live over a WebSocket (`content/live-updates.ts` + `emotes/seventv-updates.ts`).
- Per-channel usage counts (`emotes/usage.ts`, `chrome.storage.local`) rank suggestions and choose which emotes the picker shows.

Conventions to follow when changing features:
- **Selectors:** every Twitch DOM selector lives in `src/content/selectors.ts` (`SEL`), because Twitch renames classes. Add new ones there, with a comment saying what the element is.
- **Feature shape:** a feature is an `installX(enabled: () => boolean, ...)` function or a class that returns or exposes `check()`/`apply()`. It reads settings lazily through the getter, and `applySettings` re-runs it when settings change. DOM watching uses `MutationObserver` plus a `setTimeout` debounce. Don't use `requestAnimationFrame`: it never fires in background tabs. `content/auto-click.ts` is the template for "click this Twitch button when it appears".
- **Settings readiness:** features that act on their own (muting, auto-clicking, opening the sidebar, applying a saved boost) are gated on `settingsLoaded && settings.x`. They mustn't act on `DEFAULT_SETTINGS` before the user's saved settings arrive.
- **Adding a setting:** settings are stored in `chrome.storage.sync` under one `settings` key and always pass through `normalizeSettings`. A new setting needs the field and its doc comment in `Settings`, a default, a line in `normalizeSettings`, and a control in `popup/index.html` and `popup/popup.ts`. The control's `name` matches the field name.
- **CSS toggles:** features that are purely CSS are toggled by `twitchy-*` classes on `<html>`, defined in `content/styles.css`.
- **Logging:** log messages are prefixed `[twitchy]`.

## Tests

- **What's tested:** tests run in jsdom against trimmed copies of Twitch's markup, inlined in each test file. Provider parsing uses real API responses saved in `tests/fixtures/`.
- **Listener isolation:** feature installs add document and window listeners that outlive a test. Call `isolateListeners()` from `tests/helpers.ts` in a `describe` to remove them after each test.
- **Imports:** pure logic is exported separately from the `install*` wiring so tests can call it directly. Tests import from `../src/...` with `.ts`-less paths.
