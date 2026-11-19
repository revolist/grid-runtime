// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { announcePopupOpen, subscribeToPopupOpen } from './popup-coordinator';

describe('popup coordinator', () => {
  it('closes other popup owners within the same grid', () => {
    const grid = document.createElement('revo-grid') as HTMLRevoGridElement;
    const firstOwner = {};
    const secondOwner = {};
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    const unsubscribeFirst = subscribeToPopupOpen(grid, firstOwner, closeFirst);
    const unsubscribeSecond = subscribeToPopupOpen(grid, secondOwner, closeSecond);

    announcePopupOpen(grid, firstOwner);

    expect(closeFirst).not.toHaveBeenCalled();
    expect(closeSecond).toHaveBeenCalledOnce();

    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('does not affect popup owners registered to another grid', () => {
    const firstGrid = document.createElement('revo-grid') as HTMLRevoGridElement;
    const secondGrid = document.createElement('revo-grid') as HTMLRevoGridElement;
    const closeSecondGridPopup = vi.fn();
    const unsubscribe = subscribeToPopupOpen(secondGrid, {}, closeSecondGridPopup);

    announcePopupOpen(firstGrid, {});

    expect(closeSecondGridPopup).not.toHaveBeenCalled();
    unsubscribe();
  });
});
