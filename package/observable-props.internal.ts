export interface ObservablePropHost {
  revogrid: HTMLRevoGridElement;
  addEventListener(eventName: any, callback: (event: CustomEvent<any>) => void): void;
}

const observedProperties = new WeakMap<object, Map<string, () => void>>();

/** Intercept a direct property assignment for bindObservableProp. */
export function observePropertyAssignment<T = unknown>(
  owner: ObservablePropHost,
  propName: string,
  callback: (value: T) => void,
) {
  let observers = observedProperties.get(owner);
  if (!observers) {
    observers = new Map();
    observedProperties.set(owner, observers);
  }
  if (observers.has(propName)) {
    return;
  }

  const target = owner.revogrid as unknown as Record<string, unknown>;
  const ownDescriptor = Object.getOwnPropertyDescriptor(target, propName);
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), propName);
  const descriptor = ownDescriptor || prototypeDescriptor;
  if (descriptor && !descriptor.configurable) {
    return;
  }

  let localValue = target[propName];
  let assigned = false;
  Object.defineProperty(target, propName, {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get: () => (descriptor?.get ? descriptor.get.call(target) : localValue),
    set: (value) => {
      assigned = true;
      if (descriptor?.set) {
        descriptor.set.call(target, value);
      } else {
        localValue = value;
      }
      callback(value as T);
    },
  });

  observers.set(propName, () => {
    if (ownDescriptor) {
      Object.defineProperty(
        target,
        propName,
        'value' in ownDescriptor ? { ...ownDescriptor, value: localValue } : ownDescriptor,
      );
      return;
    }
    delete target[propName];
    if (assigned && !prototypeDescriptor?.set) {
      Object.defineProperty(target, propName, {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        writable: true,
        value: localValue,
      });
    }
  });
}

export function releaseObservableProps(owner: ObservablePropHost) {
  const observers = observedProperties.get(owner);
  observers?.forEach((restore) => restore());
  observers?.clear();
  observedProperties.delete(owner);
}
