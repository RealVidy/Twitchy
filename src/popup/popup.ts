import { loadSettings, PICKER_LIMIT_MAX, PICKER_LIMIT_MIN, saveSettings, type Settings } from '../shared/settings';

const form = document.querySelector<HTMLFormElement>('#settings')!;
const pickerEmotes = form.elements.namedItem('pickerEmotes') as HTMLInputElement;
const pickerLimit = form.elements.namedItem('pickerLimit') as HTMLInputElement;
const hideLockedEmotes = form.elements.namedItem('hideLockedEmotes') as HTMLInputElement;

pickerLimit.min = String(PICKER_LIMIT_MIN);
pickerLimit.max = String(PICKER_LIMIT_MAX);

function show(s: Settings): void {
  pickerEmotes.checked = s.pickerEmotes;
  pickerLimit.value = String(s.pickerLimit);
  pickerLimit.disabled = !s.pickerEmotes;
  hideLockedEmotes.checked = s.hideLockedEmotes;
}

form.addEventListener('change', async () => {
  show(
    await saveSettings({
      pickerEmotes: pickerEmotes.checked,
      pickerLimit: Number(pickerLimit.value),
      hideLockedEmotes: hideLockedEmotes.checked,
    }),
  );
});
form.addEventListener('submit', (e) => e.preventDefault());

void loadSettings().then(show);
