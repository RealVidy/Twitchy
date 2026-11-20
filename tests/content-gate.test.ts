import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findContentGateButton, installContentGateSkipper } from '../src/content/content-gate';

/** Twitch's content warning over the player, trimmed. */
const GATE = `
  <div data-a-target="content-classification-gate-overlay">
    <section id="channel-player-gate" aria-label="Player Controls">
      <p>Just one second...</p>
      <p>It may contain: Mature-rated game</p>
      <button data-a-target="content-classification-gate-overlay-start-watching-button">
        <div data-a-target="tw-core-button-label-text">Start Watching</div>
      </button>
      <a href="/"><div data-a-target="tw-core-button-label-text">Go Home</div></a>
    </section>
  </div>`;

describe('findContentGateButton', () => {
  it('finds Start Watching, not Go Home', () => {
    document.body.innerHTML = '<div class="player"></div>';
    expect(findContentGateButton()).toBeNull();
    document.querySelector('.player')!.innerHTML = GATE;
    expect(findContentGateButton()?.textContent?.trim()).toBe('Start Watching');
  });

  it('finds the older mature gate button too', () => {
    document.body.innerHTML = '<button data-a-target="player-overlay-mature-accept">Start Watching</button>';
    expect(findContentGateButton()).not.toBeNull();
  });
});

describe('installContentGateSkipper', () => {
  let enabled: boolean;
  let skipper: { check: () => void };

  beforeEach(() => {
    vi.useFakeTimers();
    // A fresh body, so the skippers installed by earlier tests no longer see the page.
    document.body = document.createElement('body');
    document.body.innerHTML = '<div class="player"></div>';
    enabled = true;
    skipper = installContentGateSkipper(() => enabled);
  });

  function showGate(): HTMLButtonElement {
    document.querySelector('.player')!.innerHTML = GATE;
    const button = findContentGateButton()!;
    button.onclick = vi.fn();
    return button;
  }

  it('clicks Start Watching once when the warning shows up', async () => {
    const button = showGate();
    await vi.advanceTimersByTimeAsync(300);
    expect(button.onclick).toHaveBeenCalledOnce();

    document.querySelector('.player')!.append(document.createElement('span'));
    await vi.advanceTimersByTimeAsync(300);
    expect(button.onclick).toHaveBeenCalledOnce();
  });

  it('clicks again on the next channel’s warning', async () => {
    showGate();
    await vi.advanceTimersByTimeAsync(300);
    const next = showGate();
    await vi.advanceTimersByTimeAsync(300);
    expect(next.onclick).toHaveBeenCalledOnce();
  });

  it('leaves the warning alone while turned off', async () => {
    enabled = false;
    const button = showGate();
    await vi.advanceTimersByTimeAsync(300);
    expect(button.onclick).not.toHaveBeenCalled();

    enabled = true;
    skipper.check();
    expect(button.onclick).toHaveBeenCalledOnce();
  });
});
