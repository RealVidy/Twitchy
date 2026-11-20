// Twitch changes its class names now and then. Every selector we rely on lives here.
export const SEL = {
  chatContainer: '[data-test-selector="chat-scrollable-area__message-container"]',
  /** Plain text parts of a chat message. Mentions, links and Twitch emotes are separate nodes. */
  textFragment: '.text-fragment[data-a-target="chat-message-text"]',
  chatInput: '[data-a-target="chat-input"]',
} as const;
