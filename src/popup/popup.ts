import {
  BADGE_KINDS,
  loadSettings,
  PICKER_LIMIT_MAX,
  PICKER_LIMIT_MIN,
  saveSettings,
  type BadgeKind,
  type Settings,
} from '../shared/settings';

const form = document.querySelector<HTMLFormElement>('#settings')!;
const pickerEmotes = form.elements.namedItem('pickerEmotes') as HTMLInputElement;
const pickerLimit = form.elements.namedItem('pickerLimit') as HTMLInputElement;
const colonAutocomplete = form.elements.namedItem('colonAutocomplete') as HTMLInputElement;
const messageHistory = form.elements.namedItem('messageHistory') as HTMLInputElement;
const hideLockedEmotes = form.elements.namedItem('hideLockedEmotes') as HTMLInputElement;
const hideSendButton = form.elements.namedItem('hideSendButton') as HTMLInputElement;
const badgeBoxes = Object.fromEntries(
  BADGE_KINDS.map((k) => [k, form.elements.namedItem(`badge-${k}`) as HTMLInputElement]),
) as Record<BadgeKind, HTMLInputElement>;

pickerLimit.min = String(PICKER_LIMIT_MIN);
pickerLimit.max = String(PICKER_LIMIT_MAX);

function show(s: Settings): void {
  pickerEmotes.checked = s.pickerEmotes;
  pickerLimit.value = String(s.pickerLimit);
  pickerLimit.disabled = !s.pickerEmotes;
  colonAutocomplete.checked = s.colonAutocomplete;
  messageHistory.checked = s.messageHistory;
  hideLockedEmotes.checked = s.hideLockedEmotes;
  hideSendButton.checked = s.hideSendButton;
  for (const k of BADGE_KINDS) badgeBoxes[k].checked = s.badges[k];
}

form.addEventListener('change', async () => {
  show(
    await saveSettings({
      pickerEmotes: pickerEmotes.checked,
      pickerLimit: Number(pickerLimit.value),
      colonAutocomplete: colonAutocomplete.checked,
      messageHistory: messageHistory.checked,
      hideLockedEmotes: hideLockedEmotes.checked,
      hideSendButton: hideSendButton.checked,
      badges: Object.fromEntries(BADGE_KINDS.map((k) => [k, badgeBoxes[k].checked])) as Record<BadgeKind, boolean>,
    }),
  );
});
form.addEventListener('submit', (e) => e.preventDefault());

void loadSettings().then(show);
