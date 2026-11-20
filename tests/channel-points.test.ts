import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findBonusButton, installBonusClaimer } from '../src/content/channel-points';

/** Twitch's points summary, trimmed; the bonus button sits next to the balance. */
const SUMMARY = `
  <div data-test-selector="community-points-summary">
    <button aria-label="Bits and Points Balances"><span>252K</span></button>
    <div class="slot"></div>
  </div>`;

const BONUS = `
  <button aria-label="Claim Bonus">
    <div data-a-target="tw-core-button-label-text">
      <div class="claimable-bonus__icon"><svg></svg></div>
    </div>
  </button>`;

describe('findBonusButton', () => {
  beforeEach(() => {
    document.body.innerHTML = SUMMARY;
  });

  it('finds the button around the bonus icon, whatever its label', () => {
    expect(findBonusButton()).toBeNull();
    document.querySelector('.slot')!.innerHTML = BONUS.replace('Claim Bonus', 'Récupérer le bonus');
    expect(findBonusButton()?.getAttribute('aria-label')).toBe('Récupérer le bonus');
  });

  it('ignores a bonus icon outside the points summary', () => {
    document.body.insertAdjacentHTML('beforeend', BONUS);
    expect(findBonusButton()).toBeNull();
  });
});

describe('installBonusClaimer', () => {
  let enabled: boolean;
  let claimer: { check: () => void };

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = SUMMARY;
    enabled = true;
    claimer = installBonusClaimer(() => enabled);
  });

  function showBonus(): HTMLButtonElement {
    document.querySelector('.slot')!.innerHTML = BONUS;
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Claim Bonus"]')!;
    button.onclick = vi.fn();
    return button;
  }

  it('clicks the bonus once when it shows up', async () => {
    const button = showBonus();
    await vi.advanceTimersByTimeAsync(300);
    expect(button.onclick).toHaveBeenCalledOnce();

    document.querySelector('.slot')!.append(document.createElement('span'));
    await vi.advanceTimersByTimeAsync(300);
    expect(button.onclick).toHaveBeenCalledOnce();
  });

  it('leaves it alone while turned off, and claims once turned on', async () => {
    enabled = false;
    const button = showBonus();
    await vi.advanceTimersByTimeAsync(300);
    expect(button.onclick).not.toHaveBeenCalled();

    enabled = true;
    claimer.check();
    expect(button.onclick).toHaveBeenCalledOnce();
  });
});
