// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PluginProviders } from '@revolist/revogrid';
import { isEditableKeyboardTarget, isGridKeyboardEvent, retainGridKeyboardOwnershipGuard } from './keyboard-ownership';

afterEach(() => {
  document.body.innerHTML = '';
});

function createContext(focused = true) {
  const grid = document.createElement('revo-grid') as HTMLRevoGridElement;
  const outside = document.createElement('input');
  document.body.append(grid, outside);
  const providers = {
    selection: {
      focusedStore: focused ? {} : undefined,
    },
  } as unknown as Pick<PluginProviders, 'selection'>;
  return { grid, outside, providers };
}

describe('grid keyboard ownership', () => {
  function dispatchBeforeKeyDown(grid: HTMLRevoGridElement, original: KeyboardEvent) {
    const event = new CustomEvent('beforekeydown', {
      bubbles: true,
      cancelable: true,
      detail: { original },
    });
    grid.dispatchEvent(event);
    return event;
  }

  function dispatchKeyDown(target: Element, key: string) {
    let original: KeyboardEvent | undefined;
    target.addEventListener(
      'keydown',
      (event) => {
        original = event as KeyboardEvent;
      },
      { once: true },
    );
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    return original!;
  }

  it('rejects an outside control even when provider focus is stale', () => {
    const { grid, outside, providers } = createContext();
    let owned: boolean | undefined;
    outside.addEventListener('keydown', (event) => {
      owned = isGridKeyboardEvent(event, grid, providers, {
        allowDetached: true,
      });
    });

    outside.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
      }),
    );

    expect(owned).toBe(false);
  });

  it.each([
    ['input', document.createElement('input')],
    ['textarea', document.createElement('textarea')],
    ['select', document.createElement('select')],
    [
      'contenteditable',
      Object.assign(document.createElement('div'), {
        contentEditable: 'true',
      }),
    ],
  ])('recognizes an editable %s keyboard target', (_name, control) => {
    const { grid } = createContext();
    grid.append(control);
    let editable = false;
    control.addEventListener('keydown', (event) => {
      editable = isEditableKeyboardTarget(event as KeyboardEvent, grid);
    });

    control.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'F10',
        shiftKey: true,
        bubbles: true,
        composed: true,
      }),
    );

    expect(editable).toBe(true);
  });

  it('does not classify a regular grid cell as an editable target', () => {
    const { grid } = createContext();
    const cell = document.createElement('div');
    grid.append(cell);
    let editable = true;
    cell.addEventListener('keydown', (event) => {
      editable = isEditableKeyboardTarget(event, grid);
    });

    cell.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'F10',
        shiftKey: true,
        bubbles: true,
        composed: true,
      }),
    );

    expect(editable).toBe(false);
  });

  it('accepts events dispatched from inside the grid', () => {
    const { grid, providers } = createContext(false);
    const input = document.createElement('input');
    grid.append(input);
    let owned: boolean | undefined;
    input.addEventListener('keydown', (event) => {
      owned = isGridKeyboardEvent(event, grid, providers);
    });

    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
      }),
    );

    expect(owned).toBe(true);
  });

  it('supports an explicitly allowed detached integration event', () => {
    const { grid, providers } = createContext(false);
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });

    expect(isGridKeyboardEvent(event, grid, providers)).toBe(false);
    expect(isGridKeyboardEvent(event, grid, providers, { allowDetached: true })).toBe(true);
  });

  it('cancels only the grid proxy for an outside input key', () => {
    const { grid, outside, providers } = createContext();
    const release = retainGridKeyboardOwnershipGuard(grid, providers);
    const original = dispatchKeyDown(outside, '3');

    const proxy = dispatchBeforeKeyDown(grid, original);

    expect(proxy.defaultPrevented).toBe(true);
    expect(original.defaultPrevented).toBe(false);
    release();
  });

  it('keeps grid-owned and focused document integration events available', () => {
    const { grid, providers } = createContext();
    const cell = document.createElement('div');
    grid.append(cell);
    const release = retainGridKeyboardOwnershipGuard(grid, providers);

    expect(dispatchBeforeKeyDown(grid, dispatchKeyDown(cell, '3')).defaultPrevented).toBe(false);
    expect(dispatchBeforeKeyDown(grid, dispatchKeyDown(document.documentElement, '3')).defaultPrevented).toBe(false);
    release();
  });

  it('shares one listener until the final plugin releases it', () => {
    const { grid, outside, providers } = createContext();
    const addListener = vi.spyOn(grid, 'addEventListener');
    const removeListener = vi.spyOn(grid, 'removeEventListener');
    const releaseFirst = retainGridKeyboardOwnershipGuard(grid, providers);
    const releaseSecond = retainGridKeyboardOwnershipGuard(grid, providers);

    expect(addListener.mock.calls.filter(([type]) => type === 'beforekeydown')).toHaveLength(1);
    releaseFirst();
    expect(removeListener.mock.calls.filter(([type]) => type === 'beforekeydown')).toHaveLength(0);
    expect(dispatchBeforeKeyDown(grid, dispatchKeyDown(outside, '3')).defaultPrevented).toBe(true);

    releaseSecond();
    expect(removeListener.mock.calls.filter(([type]) => type === 'beforekeydown')).toHaveLength(1);
    expect(dispatchBeforeKeyDown(grid, dispatchKeyDown(outside, '3')).defaultPrevented).toBe(false);
  });
});
