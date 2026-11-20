// Twitch changes its class names now and then. Every selector we rely on lives here.
export const SEL = {
  chatContainer: '[data-test-selector="chat-scrollable-area__message-container"]',
  /** One chat message; its aria-label is "name: message", even after the message is deleted. */
  chatLine: '.chat-line__message',
  /** What the user wrote. Twitch takes it out when a moderator deletes the message. */
  messageBody: '[data-a-target="chat-line-message-body"]',
  /** "message deleted by a moderator.", which Twitch puts where the body was. */
  deletedNotice: '[data-a-target="chat-deleted-message-placeholder"]',
  /** Plain text parts of a chat message. Mentions, links and Twitch emotes are separate nodes. */
  textFragment: '.text-fragment[data-a-target="chat-message-text"]',
  chatInput: '[data-a-target="chat-input"]',
  /** Wraps the chat box, the tray Twitch opens above it and the buttons under it. */
  chatInputContainer: '.chat-input',
  /** Twitch's own suggestions above the chat box, for `:emote` and `@user`. */
  autocompleteList: '.autocomplete-match-list',
  /** One suggestion; data-a-target holds the emote name. */
  autocompleteItem: 'button[data-a-target]',

  /** The emote picker balloon, while it is open. */
  emotePicker: '[data-a-target="emote-picker"]',
  pickerSearch: 'input[type="search"]',
  /** The scrolling list of emote sections; Twitch renders a new one when you search. */
  pickerContent: '.emote-picker__tab-content',
  /** Twitch gives this class to "Frequently Used" and to search result blocks. */
  pickerBlock: '.emote-picker__content-block',
  pickerGrid: '.emote-grid',
  pickerSectionTitle: '.emote-grid-section__header-title',
  pickerNavButton: '.emote-picker__nav-content button',
  /** The lock drawn over an emote you have not unlocked. */
  emoteLock: '[data-test-selector="badge-button-lock"]',

  /** Row under the chat input: points, settings gear, Chat button. */
  chatButtons: '[data-test-selector="chat-input-buttons-container"]',
  /** The Chat button, which sends the message. */
  chatSendButton: '[data-a-target="chat-send-button"]',
  /** The points balance under the chat input; Twitch adds the bonus button inside it. */
  pointsSummary: '[data-test-selector="community-points-summary"]',
  /** The icon in the "Claim Bonus" button, whose label changes with Twitch's language. */
  claimBonusIcon: '.claimable-bonus__icon',
  /** "Start Watching" on the content warning over the player; older mature gate as a fallback. */
  contentGateButton:
    '[data-a-target="content-classification-gate-overlay-start-watching-button"], [data-a-target="player-overlay-mature-accept"]',
  chatSettingsButton: '[data-a-target="chat-settings"]',
  /** Lives in the "Stream Chat" header, which we hide. */
  communityButton: '[data-test-selector="chat-viewer-list"]',
  /** Floats over the chat header while chat is open; becomes "Expand Chat" when collapsed. */
  collapseChatButton: '[data-a-target="right-column__toggle-collapse-btn"]',

  userMenuToggle: '[data-a-target="user-menu-toggle"]',
  /** The bell in the top bar and its unread count. */
  notifications: '.onsite-notifications',
  notificationsButton: '.onsite-notifications button',
  whispersButton: '[data-a-target="whisper-box-button"]',
  /** Twitch's red count bubbles. */
  countBadge: '.tw-number-badge, [class*="NumberBadge"], .tw-pill',
} as const;
