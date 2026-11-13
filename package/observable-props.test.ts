// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { AdditionalData } from '@revolist/revogrid';
import { bindObservableProp, type ObservablePropHost } from './observable-props.js';
import { releaseObservableProps } from './observable-props.internal.js';

function createBindingHarness(grid: HTMLRevoGridElement & Record<string, unknown>) {
  const plugin = {
    revogrid: grid,
    addEventListener: vi.fn((event: string, callback: EventListener) => {
      grid.addEventListener(event, callback);
    }),
  } as unknown as ObservablePropHost;

  return { plugin };
}

describe('bindObservableProp', () => {
  it('resolves kebab-case direct property aliases for initial values and updates', () => {
    const initialConfig = { prop: 'name' };
    const updatedConfig = { prop: 'price' };
    const grid = document.createElement('revo-grid') as HTMLRevoGridElement & Record<string, unknown>;
    grid.additionalData = {} as AdditionalData;
    grid['row-order'] = initialConfig;
    const { plugin } = createBindingHarness(grid);
    const apply = vi.fn();

    const value = bindObservableProp(plugin, {
      prop: 'rowOrder',
      defaultValue: {},
      apply,
    });

    expect(value).toBe(initialConfig);
    grid['row-order'] = updatedConfig;

    expect(apply).toHaveBeenCalledWith(updatedConfig, 'property');
  });

  it('does not remap a same-reference property value reapplied by a framework', () => {
    const config = { chunkSize: 50 };
    const replacement = { chunkSize: 100 };
    const grid = document.createElement('revo-grid') as HTMLRevoGridElement & Record<string, unknown>;
    grid.additionalData = {} as AdditionalData;
    grid.infinityScroll = config;
    const { plugin } = createBindingHarness(grid);
    const map = vi.fn((value) => ({ ...value }));
    const apply = vi.fn();

    bindObservableProp(plugin, {
      prop: 'infinityScroll',
      map,
      apply,
    });

    grid.infinityScroll = config;

    expect(map).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();

    grid.infinityScroll = replacement;

    expect(map).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('reapplies a direct property after an intervening additionalData update', () => {
    const directConfig = { chunkSize: 50 };
    const additionalConfig = { chunkSize: 100 };
    const grid = document.createElement('revo-grid') as HTMLRevoGridElement & Record<string, unknown>;
    grid.additionalData = {} as AdditionalData;
    grid.infinityScroll = directConfig;
    const { plugin } = createBindingHarness(grid);
    const apply = vi.fn();

    bindObservableProp(plugin, {
      prop: 'infinityScroll',
      additionalDataKey: 'infinityScroll',
      map: (value) => ({ ...(value as typeof directConfig) }),
      apply,
    });

    grid.dispatchEvent(
      new CustomEvent('additionaldatachanged', {
        detail: { infinityScroll: additionalConfig },
      }),
    );
    grid.infinityScroll = directConfig;

    expect(apply).toHaveBeenNthCalledWith(1, additionalConfig, 'additionalData');
    expect(apply).toHaveBeenNthCalledWith(2, directConfig, 'property');
  });

  it('restores observed properties during owner teardown', () => {
    const grid = document.createElement('revo-grid') as HTMLRevoGridElement & Record<string, unknown>;
    const original = { chunkSize: 50 };
    grid.infinityScroll = original;
    const { plugin } = createBindingHarness(grid);

    bindObservableProp(plugin, { prop: 'infinityScroll' });
    releaseObservableProps(plugin);

    expect(grid.infinityScroll).toBe(original);
    expect(Object.getOwnPropertyDescriptor(grid, 'infinityScroll')?.value).toBe(original);
  });

  it('preserves the latest direct value when observation is torn down', () => {
    const grid = document.createElement('revo-grid') as HTMLRevoGridElement & Record<string, unknown>;
    const initial = { text: 'Lisbon' };
    const latest = { text: 'Porto' };
    grid.quickFilter = initial;
    const { plugin } = createBindingHarness(grid);

    bindObservableProp(plugin, { prop: 'quickFilter' });
    grid.quickFilter = latest;
    releaseObservableProps(plugin);

    expect(grid.quickFilter).toBe(latest);
    expect(Object.getOwnPropertyDescriptor(grid, 'quickFilter')?.value).toBe(latest);
  });
});
