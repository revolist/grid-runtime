/**
 * Cross-package marker for plugins that own a projected row lifecycle.
 *
 * The universal menu may still contribute copy, export, and view commands, but
 * local cell/row mutations require an application command handler while a
 * marked owner is active.
 */
export const DATA_GRID_CONTEXT_MENU_EXTERNAL_ROW_OWNER = Symbol.for(
  '@revolist/revogrid-pro/data-grid-context-menu/external-row-owner',
);

export interface DataGridContextMenuExternalRowOwner {
  readonly [DATA_GRID_CONTEXT_MENU_EXTERNAL_ROW_OWNER]: true;
}

export function ownsDataGridProjectedRows(plugin: unknown): plugin is DataGridContextMenuExternalRowOwner {
  return (
    typeof plugin === 'object' &&
    plugin !== null &&
    DATA_GRID_CONTEXT_MENU_EXTERNAL_ROW_OWNER in plugin &&
    plugin[DATA_GRID_CONTEXT_MENU_EXTERNAL_ROW_OWNER] === true
  );
}
