# Changelog

All notable changes to this project are listed here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-11-23

- Player: each channel plays at the volume it was last left at, whether set with Twitch's slider or the mouse wheel. Muting stays the same for all channels. A "Keep each channel at its volume" setting turns it off.
- Sidebar: a preview plays at the volume saved for its channel, or at the stream's volume for a channel not watched yet.

## [1.1.0] - 2026-11-22

- Sidebar: a "Preview sound" setting plays stream previews with sound (the default, even while the stream being watched is muted), always muted, or muted as the stream being watched is.
- Sidebar: previews follow the mute and volume of the stream playing in the tab rather than only Twitch's saved setting, so muting Twitch in another tab no longer mutes them.
- Sidebar: a preview that starts muted against the setting gets its sound back once the page has had a click or key press.

## [1.0.0] - 2026-11-22

First stable release.

- 7TV, BetterTTV and FrankerFaceZ emotes in chat, with live 7TV emote set updates, stacked zero-width emotes and tooltips on hover.
- Emote picker with third-party emotes, Tab completion and suggestions after a colon.
- Sent messages come back with the Up and Down arrows; deleted messages stay visible, struck through or faded.
- Channel points bonus claimed automatically.
- Player: click to mute, mouse wheel volume past 100% remembered per channel, latency, quality and bitrate next to the viewer count, mature content warning skipped.
- Sidebar: stream previews with sound on hover, collapsed sidebar expands on hover.
- Tidier chat, sidebar and top bar, with settings for notification badges and the Chat button.
