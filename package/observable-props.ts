import type { AdditionalData } from '@revolist/revogrid';
import { observePropertyAssignment, type ObservablePropHost } from './observable-props.internal.js';

export type { ObservablePropHost } from './observable-props.internal.js';

export type ObservablePropSource = 'initial' | 'property' | 'additionalData';

export interface ObservablePropBindingOptions<TInput, TValue = TInput> {
  prop: string;
  propAliases?: string[];
  additionalDataKey?: keyof AdditionalData & string;
  additionalDataAliases?: (keyof AdditionalData & string)[];
  defaultValue?: TInput;
  map?: (value: TInput | undefined, source: ObservablePropSource) => TValue;
  equals?: (previous: TValue, next: TValue) => boolean;
  apply?: (value: TValue, source: ObservablePropSource) => void;
}

function hasOwnValue(object: unknown, key: string): boolean {
  return !!object && Object.prototype.hasOwnProperty.call(object, key);
}

function toKebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function getPropNames(prop: string, aliases: string[] = []): string[] {
  return Array.from(new Set([prop, toKebabCase(prop), ...aliases]));
}

export function bindObservableProp<TInput, TValue = TInput>(
  plugin: ObservablePropHost,
  options: ObservablePropBindingOptions<TInput, TValue>,
): TValue {
  const grid = plugin.revogrid as HTMLRevoGridElement & Record<string, unknown>;
  const additionalData = grid.additionalData as AdditionalData | undefined;
  const additionalDataKey = options.additionalDataKey ?? options.prop;
  const additionalDataKeys = Array.from(new Set([additionalDataKey, ...(options.additionalDataAliases ?? [])]));
  const propNames = getPropNames(options.prop, options.propAliases);
  const initialAdditionalDataKey = additionalDataKeys.find((key) => hasOwnValue(additionalData, key));
  const hasInitialAdditionalData = initialAdditionalDataKey !== undefined;

  const mapValue = (value: TInput | undefined, source: ObservablePropSource): TValue => {
    if (options.map) {
      return options.map(value, source);
    }
    return value as TValue;
  };

  const hasConfiguredAlias = propNames.slice(1).some((prop) => hasOwnValue(grid, prop) && grid[prop] !== undefined);
  const initialProp =
    propNames.find((prop) => {
      if (!hasOwnValue(grid, prop) || grid[prop] === undefined) {
        return false;
      }
      return !(
        prop === options.prop &&
        grid[prop] === options.defaultValue &&
        (hasConfiguredAlias || hasInitialAdditionalData)
      );
    }) ??
    propNames.find((prop) => {
      if (grid[prop] === undefined) {
        return false;
      }
      return !(prop === options.prop && grid[prop] === options.defaultValue && hasInitialAdditionalData);
    });
  const initialInput = initialProp
    ? (grid[initialProp] as TInput)
    : initialAdditionalDataKey
      ? (additionalData?.[initialAdditionalDataKey] as TInput)
      : options.defaultValue;
  let currentValue = mapValue(initialInput, 'initial');
  let currentInput = initialInput;
  let currentInputSource: ObservablePropSource = initialProp
    ? 'property'
    : initialAdditionalDataKey
      ? 'additionalData'
      : 'initial';

  const applyIfChanged = (input: TInput | undefined, source: ObservablePropSource) => {
    // Framework wrappers can reassign every element property after any render.
    // Skip unchanged direct inputs before mapping so normalizers that return a
    // fresh object do not turn a same-reference assignment into a plugin reset.
    if (source === 'property' && currentInputSource === 'property' && Object.is(currentInput, input)) {
      return;
    }
    const nextValue = mapValue(input, source);
    currentInput = input;
    currentInputSource = source;
    const isEqual = options.equals ? options.equals(currentValue, nextValue) : Object.is(currentValue, nextValue);
    if (isEqual) {
      return;
    }
    currentValue = nextValue;
    options.apply?.(nextValue, source);
  };

  propNames.forEach((prop) => {
    observePropertyAssignment<TInput | undefined>(plugin, prop, (value) => {
      applyIfChanged(value, 'property');
    });
  });

  plugin.addEventListener('additionaldatachanged', ({ detail }: CustomEvent<AdditionalData>) => {
    const changedAdditionalDataKey = additionalDataKeys.find((key) => hasOwnValue(detail, key));
    if (!changedAdditionalDataKey) {
      return;
    }
    applyIfChanged(detail?.[changedAdditionalDataKey] as TInput | undefined, 'additionalData');
  });

  return currentValue;
}
