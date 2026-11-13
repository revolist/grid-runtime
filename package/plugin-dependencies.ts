import type { AdditionalData, PluginBaseComponent, PluginProviders } from '@revolist/revogrid';

export type PluginDependencyKind =
  | 'required'
  | 'optional'
  | 'auto-installed'
  | 'event-integration'
  | 'config-integration'
  | 'ordering';

export type PluginDependencyPluginConstructor = abstract new (...args: any[]) => unknown;
export type PluginDependencyPluginRef = PluginDependencyPluginConstructor | (() => PluginDependencyPluginConstructor);

export type PluginDependencyContract =
  | 'aggregators'
  | 'auto-size-column'
  | 'column-types'
  | 'column-selection-handoff'
  | 'core-grouping'
  | 'direct-event-manager-config'
  | 'direct-history-config'
  | 'filtering'
  | 'direct-pagination-config'
  | 'direct-pivot-config'
  | 'direct-tree-config'
  | 'gantt-runtime'
  | 'json-clipboard'
  | 'multi-range-selection'
  | 'overlay-producer'
  | 'pagination-capable-plugin'
  | 'pro-plugin-infrastructure'
  | 'pro-ui'
  | 'row-order'
  | 'row-select'
  | 'sorting-capable-plugin'
  | 'tree-data';

export type PluginDependencyAdditionalDataKey = keyof AdditionalData & string;

export type PluginDependencyTarget =
  | {
      readonly type: 'plugin';
      readonly plugin: PluginDependencyPluginRef;
    }
  | {
      readonly type: 'plugins';
      readonly plugins: readonly PluginDependencyPluginRef[];
      readonly mode?: 'all' | 'one-of';
    }
  | {
      readonly type: 'additionalData';
      readonly key: PluginDependencyAdditionalDataKey;
      readonly path?: readonly string[];
    }
  | {
      readonly type: 'event';
      readonly event: keyof HTMLRevoGridElementEventMap & string;
    }
  | {
      readonly type: 'events';
      readonly events: readonly (keyof HTMLRevoGridElementEventMap & string)[];
    }
  | {
      readonly type: 'contract';
      readonly contract: PluginDependencyContract;
    }
  | {
      readonly type: 'property';
      readonly property: keyof HTMLRevoGridElement & string;
      readonly path?: readonly string[];
    }
  | {
      readonly type: 'ordering';
      readonly relativeTo: 'other-grid-plugins';
      readonly position: 'before' | 'after';
    };

export interface PluginDependency {
  kind: PluginDependencyKind;
  target: PluginDependencyTarget | readonly PluginDependencyTarget[];
  description: string;
}

type RuntimePluginConstructor = new (...args: any[]) => PluginBaseComponent;

/** Core exposes this method on its runtime service even though PluginServiceBase omits it. */
type RuntimePluginService = PluginProviders['plugins'] & {
  addUserPluginsAndCreate?: (
    element: HTMLRevoGridElement,
    plugins?: RuntimePluginConstructor[],
    prevPlugins?: RuntimePluginConstructor[],
    pluginData?: PluginProviders,
  ) => void;
};

interface AutoDependencyLifecycle {
  service: RuntimePluginService;
  managedPlugins: Set<PluginBaseComponent>;
}

const autoDependencyLifecycles = new WeakMap<PluginProviders['plugins'], AutoDependencyLifecycle>();

const getPluginConstructor = (pluginRef: PluginDependencyPluginRef): RuntimePluginConstructor => {
  if ('prototype' in pluginRef && pluginRef.prototype) {
    return pluginRef as RuntimePluginConstructor;
  }
  return (pluginRef as () => PluginDependencyPluginConstructor)() as RuntimePluginConstructor;
};

const getPluginName = (pluginRef: PluginDependencyPluginRef): string => {
  try {
    return getPluginConstructor(pluginRef).name;
  } catch {
    return 'unknown plugin';
  }
};

const getTargets = (target: PluginDependency['target']): readonly PluginDependencyTarget[] =>
  (Array.isArray(target) ? target : [target]) as readonly PluginDependencyTarget[];

const getAutoDependencyClasses = (
  pluginClass: RuntimePluginConstructor,
  visited = new Set<RuntimePluginConstructor>(),
): Set<RuntimePluginConstructor> => {
  if (visited.has(pluginClass)) {
    return visited;
  }
  visited.add(pluginClass);
  const dependencies = (
    pluginClass as typeof pluginClass & {
      pluginDependencies?: readonly PluginDependency[];
    }
  ).pluginDependencies;
  dependencies
    ?.filter((dependency) => dependency.kind === 'auto-installed')
    .forEach((dependency) => {
      getTargets(dependency.target).forEach((target) => {
        if (target.type === 'plugin') {
          getAutoDependencyClasses(getPluginConstructor(target.plugin), visited);
        } else if (target.type === 'plugins') {
          target.plugins.forEach((plugin) => {
            getAutoDependencyClasses(getPluginConstructor(plugin), visited);
          });
        }
      });
    });
  return visited;
};

const isPluginInClasses = (plugin: PluginBaseComponent, pluginClasses: Set<RuntimePluginConstructor>) =>
  Array.from(pluginClasses).some((pluginClass) => plugin instanceof pluginClass);

const isConstructorInClasses = (pluginClass: RuntimePluginConstructor, pluginClasses: Set<RuntimePluginConstructor>) =>
  Array.from(pluginClasses).some(
    (requiredClass) => pluginClass === requiredClass || pluginClass.prototype instanceof requiredClass,
  );

const installAutoDependencyLifecycle = (providers: PluginProviders): AutoDependencyLifecycle | undefined => {
  const service = providers.plugins as RuntimePluginService;
  const existing = autoDependencyLifecycles.get(service);
  if (existing) {
    return existing;
  }
  if (typeof service.addUserPluginsAndCreate !== 'function') {
    return undefined;
  }

  const originalAddUserPluginsAndCreate = service.addUserPluginsAndCreate.bind(service);
  const lifecycle: AutoDependencyLifecycle = {
    service,
    managedPlugins: new Set(),
  };
  autoDependencyLifecycles.set(service, lifecycle);

  service.addUserPluginsAndCreate = (element, plugins = [], prevPlugins = [], pluginData) => {
    if (!pluginData) {
      originalAddUserPluginsAndCreate(element, plugins, prevPlugins, pluginData);
      return;
    }
    const explicitPluginClasses = new Set(plugins);
    const requiredClasses = new Set<RuntimePluginConstructor>();
    plugins.forEach((pluginClass) => {
      getAutoDependencyClasses(pluginClass).forEach((dependencyClass) => {
        if (dependencyClass !== pluginClass) {
          requiredClasses.add(dependencyClass);
        }
      });
    });
    const retainedPreviousPlugins = prevPlugins.filter(
      (pluginClass) => !isConstructorInClasses(pluginClass, requiredClasses),
    );
    originalAddUserPluginsAndCreate(element, plugins, retainedPreviousPlugins, pluginData);
    const registeredPlugins = service.get();
    registeredPlugins.forEach((plugin) => {
      if (!isPluginInClasses(plugin, explicitPluginClasses) && isPluginInClasses(plugin, requiredClasses)) {
        lifecycle.managedPlugins.add(plugin);
      }
    });
    lifecycle.managedPlugins.forEach((plugin) => {
      if (!registeredPlugins.includes(plugin)) {
        lifecycle.managedPlugins.delete(plugin);
        return;
      }
      if (isPluginInClasses(plugin, explicitPluginClasses) || isPluginInClasses(plugin, requiredClasses)) {
        return;
      }
      service.remove(plugin);
      lifecycle.managedPlugins.delete(plugin);
    });
  };

  return lifecycle;
};

const hasPlugin = (plugin: unknown, providers: PluginProviders, pluginRef: PluginDependencyPluginRef): boolean => {
  const pluginClass = getPluginConstructor(pluginRef);
  return plugin instanceof pluginClass || Boolean(providers.plugins.getByClass(pluginClass));
};

const getMissingPluginDependencies = (
  plugin: unknown,
  providers: PluginProviders,
  target: PluginDependencyTarget,
): string[] => {
  if (target.type === 'plugin') {
    return hasPlugin(plugin, providers, target.plugin) ? [] : [getPluginName(target.plugin)];
  }

  if (target.type === 'plugins') {
    const missing = target.plugins.filter((pluginRef) => !hasPlugin(plugin, providers, pluginRef)).map(getPluginName);

    if (target.mode === 'one-of') {
      return missing.length === target.plugins.length ? [`one of ${target.plugins.map(getPluginName).join(', ')}`] : [];
    }

    return missing;
  }

  return [];
};

/**
 * Return an existing plugin instance by class, or create and register one.
 *
 * Use this for auto-installed plugin dependencies so host-provided plugin
 * instances are reused and duplicate runtime plugins are not added. On Core
 * runtimes, dependencies declared through `pluginDependencies` are retained
 * while any configured owner needs them and removed after their final owner.
 * The owning plugin must declare the same class as an `auto-installed` target
 * so runtime `grid.plugins` updates can resolve the ownership graph.
 */
export function ensurePlugin<T extends PluginBaseComponent>(
  providers: PluginProviders,
  pluginClass: RuntimePluginConstructor & (new (...args: any[]) => T),
  createPlugin: () => T,
): T {
  const lifecycle = installAutoDependencyLifecycle(providers);
  const existingPlugin = providers.plugins.getByClass(pluginClass);

  if (existingPlugin) {
    return existingPlugin;
  }

  const beforeCreate = lifecycle ? new Set(providers.plugins.get()) : undefined;
  const plugin = createPlugin();
  const nestedPlugins =
    lifecycle && beforeCreate
      ? providers.plugins.get().filter((createdPlugin) => !beforeCreate.has(createdPlugin))
      : [];
  providers.plugins.add(plugin);
  if (lifecycle) {
    nestedPlugins.forEach((nestedPlugin) => lifecycle.managedPlugins.delete(nestedPlugin));
    lifecycle.managedPlugins.add(plugin);
    nestedPlugins.forEach((nestedPlugin) => lifecycle.managedPlugins.add(nestedPlugin));
  }
  return plugin;
}

/**
 * Warns when required plugin class dependencies are missing.
 *
 * Metadata remains descriptive: this does not auto-install, reorder, or block plugin execution.
 */
export const warnRequiredPluginDependencies = (
  plugin: unknown,
  providers: PluginProviders,
  dependencies?: readonly PluginDependency[],
) => {
  const requiredDependencies = dependencies?.filter((dependency) => dependency.kind === 'required') ?? [];
  const missing = requiredDependencies.flatMap((dependency) =>
    getTargets(dependency.target).flatMap((target) => getMissingPluginDependencies(plugin, providers, target)),
  );

  if (!missing.length) {
    return;
  }

  const pluginName = plugin instanceof Object ? plugin.constructor.name : 'Plugin';
  console.warn(
    `[RevoGrid Pro] ${pluginName} requires ${missing.join(', ')}. ` +
      `Register required plugin dependencies before using ${pluginName}.`,
  );
};
