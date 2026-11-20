// Twitch changes its class names now and then. Every selector we rely on lives here.
export const SEL = {
  chatContainer: '[data-test-selector="chat-scrollable-area__message-container"]',
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
