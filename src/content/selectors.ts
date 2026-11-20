// Twitch changes its class names now and then. Every selector we rely on lives here.
export const SEL = {
  chatContainer: '[data-test-selector="chat-scrollable-area__message-container"]',
  /** Plain text parts of a chat message. Mentions, links and Twitch emotes are separate nodes. */
  textFragment: '.text-fragment[data-a-target="chat-message-text"]',
  chatInput: '[data-a-target="chat-input"]',

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
} as const;
