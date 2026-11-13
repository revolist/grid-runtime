import { BasePlugin, type DimensionCols, type Trimmed, getVisibleSourceItem } from '@revolist/revogrid';
import { warnRequiredPluginDependencies, type PluginDependency } from './plugin-dependencies.js';
import { releaseObservableProps } from './observable-props.internal.js';
import { retainGridKeyboardOwnershipGuard } from './keyboard-ownership.js';

export class CorePlugin extends BasePlugin {
  private attributeObservers: Map<string, MutationObserver> = new Map();
  private dependencyWarningTimer?: ReturnType<typeof setTimeout>;
  private readonly releaseKeyboardOwnershipGuard: () => void;

  constructor(...args: ConstructorParameters<typeof BasePlugin>) {
    super(...args);
    this.releaseKeyboardOwnershipGuard = retainGridKeyboardOwnershipGuard(this.revogrid, this.providers);

    this.dependencyWarningTimer = setTimeout(() => {
      this.dependencyWarningTimer = undefined;
      warnRequiredPluginDependencies(this, this.providers, (this.constructor as typeof CorePlugin).pluginDependencies);
    }, 0);
  }

  static readonly pluginDependencies?: readonly PluginDependency[];

  /**
   * Observe attribute changes on the grid element
   * @param attrName - The attribute name to observe (supports both kebab-case and camelCase)
   * @param callback - Callback function when attribute changes
   *
   * Note:
   * This observer tracks DOM attribute mutations only (e.g. setAttribute).
   * It does not react to direct property assignments like grid.someProp = value.
   */
  observeAttribute(attrName: string, callback: (value: string | null) => void) {
    // Convert kebab-case to camelCase
    const camelCaseAttr = attrName.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());

    // Create observer if it doesn't exist
    if (!this.attributeObservers.has(attrName)) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === 'attributes' &&
            (mutation.attributeName === attrName || mutation.attributeName === camelCaseAttr)
          ) {
            callback(this.revogrid.getAttribute(attrName) || this.revogrid.getAttribute(camelCaseAttr));
          }
        });
      });

      observer.observe(this.revogrid, {
        attributes: true,
        attributeFilter: [attrName, camelCaseAttr],
      });

      this.attributeObservers.set(attrName, observer);
    }
  }

  /**
   * Stop observing an attribute
   * @param attrName - The attribute name to stop observing
   */
  unobserveAttribute(attrName: string) {
    const observer = this.attributeObservers.get(attrName);
    if (observer) {
      observer.disconnect();
      this.attributeObservers.delete(attrName);
    }
  }

  /**
   * Set the trimmed state for a column
   */
  setColumnTrimmed(trimmed: Record<string, Record<string, boolean | undefined>>, type: DimensionCols) {
    const store = this.providers.column.dataSources[type];
    store.addTrimmed(trimmed as Trimmed);
    this.providers.dimension.setTrimmed(trimmed as Trimmed, type);
    this.providers.dimension.setData(getVisibleSourceItem(store.store).length, type, type !== 'rgCol');
  }

  /**
   * Destroy plugin and clean up all observers
   */
  destroy() {
    this.releaseKeyboardOwnershipGuard();
    if (this.dependencyWarningTimer !== undefined) {
      clearTimeout(this.dependencyWarningTimer);
      this.dependencyWarningTimer = undefined;
    }
    // Clean up all attribute observers
    this.attributeObservers.forEach((observer) => observer.disconnect());
    this.attributeObservers.clear();
    releaseObservableProps(this);

    // Call parent destroy
    super.destroy();
  }
}
