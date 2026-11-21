import {
  BADGE_KINDS,
  loadSettings,
  PICKER_LIMIT_MAX,
  PICKER_LIMIT_MIN,
  saveSettings,
  type BadgeKind,
  type DeletedStyle,
  type Settings,
} from '../shared/settings';

const form = document.querySelector<HTMLFormElement>('#settings')!;
const pickerEmotes = form.elements.namedItem('pickerEmotes') as HTMLInputElement;
const pickerLimit = form.elements.namedItem('pickerLimit') as HTMLInputElement;
const colonAutocomplete = form.elements.namedItem('colonAutocomplete') as HTMLInputElement;
const messageHistory = form.elements.namedItem('messageHistory') as HTMLInputElement;
const deletedMessages = form.elements.namedItem('deletedMessages') as HTMLSelectElement;
const autoClaimPoints = form.elements.namedItem('autoClaimPoints') as HTMLInputElement;
const skipContentWarning = form.elements.namedItem('skipContentWarning') as HTMLInputElement;
const videoStats = form.elements.namedItem('videoStats') as HTMLInputElement;
const sidebarPreviews = form.elements.namedItem('sidebarPreviews') as HTMLInputElement;
const sidebarPreviewVideo = form.elements.namedItem('sidebarPreviewVideo') as HTMLInputElement;
const sidebarExpandOnHover = form.elements.namedItem('sidebarExpandOnHover') as HTMLInputElement;
const volumeWheel = form.elements.namedItem('volumeWheel') as HTMLInputElement;
const clickToMute = form.elements.namedItem('clickToMute') as HTMLInputElement;
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
  deletedMessages.value = s.deletedMessages;
  autoClaimPoints.checked = s.autoClaimPoints;
  skipContentWarning.checked = s.skipContentWarning;
  videoStats.checked = s.videoStats;
  sidebarPreviews.checked = s.sidebarPreviews;
  sidebarPreviewVideo.checked = s.sidebarPreviewVideo;
  sidebarPreviewVideo.disabled = !s.sidebarPreviews;
  sidebarExpandOnHover.checked = s.sidebarExpandOnHover;
  volumeWheel.checked = s.volumeWheel;
  clickToMute.checked = s.clickToMute;
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
      deletedMessages: deletedMessages.value as DeletedStyle,
      autoClaimPoints: autoClaimPoints.checked,
      skipContentWarning: skipContentWarning.checked,
      videoStats: videoStats.checked,
      sidebarPreviews: sidebarPreviews.checked,
      sidebarPreviewVideo: sidebarPreviewVideo.checked,
      sidebarExpandOnHover: sidebarExpandOnHover.checked,
      volumeWheel: volumeWheel.checked,
      clickToMute: clickToMute.checked,
      hideLockedEmotes: hideLockedEmotes.checked,
      hideSendButton: hideSendButton.checked,
      badges: Object.fromEntries(BADGE_KINDS.map((k) => [k, badgeBoxes[k].checked])) as Record<BadgeKind, boolean>,
    }),
  );
});
form.addEventListener('submit', (e) => e.preventDefault());

void loadSettings().then(show);
