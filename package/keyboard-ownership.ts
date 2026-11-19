import type { PluginProviders } from '@revolist/revogrid';

export type GridKeyboardOwnershipOptions = {
  /**
   * Allows detached or document-targeted integrations to invoke a shortcut
   * without a focused selection store. Events from an actual outside control
   * are always rejected.
   */
  allowDetached?: boolean;
};

type BeforeKeyDownEvent = CustomEvent<HTMLRevogrOverlaySelectionElementEventMap['beforekeydown']>;

type GridKeyboardOwnershipGuard = {
  references: number;
  listener: EventListener;
};

const gridKeyboardOwnershipGuards = new WeakMap<HTMLRevoGridElement, GridKeyboardOwnershipGuard>();

const EDITABLE_KEYBOARD_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
].join(',');

/** Returns whether a keyboard event originated from an editable control. */
export function isEditableKeyboardTarget(event: KeyboardEvent, revogrid: HTMLRevoGridElement): boolean {
  const ElementConstructor = revogrid.ownerDocument.defaultView?.Element;
  if (!ElementConstructor) {
    return false;
  }
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  return path.some(
    (target) => target instanceof ElementConstructor && target.matches(EDITABLE_KEYBOARD_TARGET_SELECTOR),
  );
}

/**
 * Checks whether a document-level keyboard event belongs to this grid.
 *
 * Core overlays listen on `document`, so a grid can receive a proxy
 * `beforekeydown` after an input or other control outside the grid has taken
 * focus. DOM ownership wins over stale provider focus in that case.
 */
export function isGridKeyboardEvent(
  event: KeyboardEvent,
  revogrid: HTMLRevoGridElement,
  providers: Pick<PluginProviders, 'selection'>,
  options: GridKeyboardOwnershipOptions = {},
) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  if (path.includes(revogrid) || (!!revogrid.shadowRoot && path.includes(revogrid.shadowRoot))) {
    return true;
  }

  const target = event.target;
  const NodeConstructor = revogrid.ownerDocument.defaultView?.Node;
  if (!NodeConstructor || !(target instanceof NodeConstructor)) {
    // Programmatic integrations commonly forward a synthetic KeyboardEvent
    // without a DOM target. Provider focus remains authoritative unless the
    // caller explicitly supports detached shortcuts.
    return options.allowDetached || !!providers.selection?.focusedStore;
  }
  if (revogrid.contains(target)) {
    return true;
  }

  const document = revogrid.ownerDocument;
  return (
    (target === document || target === document.body || target === document.documentElement) &&
    (options.allowDetached || !!providers.selection?.focusedStore)
  );
}

/**
 * Retains one shared `beforekeydown` ownership guard for a Pro-enabled grid.
 *
 * Core emits this cancelable proxy from each document-listening overlay. The
 * proxy is the safe boundary to stop stale grid keyboard handling without
 * canceling the original event's native behavior in an outside control.
 */
export function retainGridKeyboardOwnershipGuard(
  revogrid: HTMLRevoGridElement,
  providers: Pick<PluginProviders, 'selection'>,
): () => void {
  let guard = gridKeyboardOwnershipGuards.get(revogrid);
  if (!guard) {
    const listener = ((event: BeforeKeyDownEvent) => {
      const original = event.detail?.original;
      if (event.defaultPrevented || !original || isGridKeyboardEvent(original, revogrid, providers)) {
        return;
      }
      event.preventDefault();
    }) as EventListener;
    guard = { references: 0, listener };
    gridKeyboardOwnershipGuards.set(revogrid, guard);
    revogrid.addEventListener('beforekeydown', listener);
  }
  guard.references += 1;

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const activeGuard = gridKeyboardOwnershipGuards.get(revogrid);
    if (!activeGuard) {
      return;
    }
    activeGuard.references -= 1;
    if (activeGuard.references > 0) {
      return;
    }
    revogrid.removeEventListener('beforekeydown', activeGuard.listener);
    gridKeyboardOwnershipGuards.delete(revogrid);
  };
}
