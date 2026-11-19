import type { ColumnRegular } from '@revolist/revogrid';

/** Shared runtime contract for plugins that replace the primary `rgRow` source. */
export const DATA_GRID_ROW_SOURCE_OWNER = Symbol.for('@revolist/revogrid-pro/row-source-owner');

export interface DataGridRowSourceOwner {
  readonly [DATA_GRID_ROW_SOURCE_OWNER]?: string;
}

/** Returns the first active row-source owner other than the requesting plugin. */
export function findDataGridRowSourceOwner(plugins: readonly unknown[], requester?: unknown): string | undefined {
  for (const plugin of plugins) {
    if (plugin === requester || (typeof plugin !== 'object' && typeof plugin !== 'function') || plugin === null) {
      continue;
    }
    const owner = (plugin as DataGridRowSourceOwner)[DATA_GRID_ROW_SOURCE_OWNER];
    if (typeof owner === 'string' && owner.trim()) {
      return owner;
    }
  }
  return undefined;
}

/** Source field metadata stays available while a plugin projects other grid columns. */
export const DATA_GRID_SOURCE_COLUMNS = Symbol.for('@revolist/revogrid-pro/source-columns');
export interface DataGridSourceColumnsOwner {
  readonly [DATA_GRID_SOURCE_COLUMNS]?: HTMLRevoGridElement['columns'];
}
export function getDataGridSourceColumns(plugins: readonly unknown[]): ColumnRegular[] {
  for (const candidate of plugins) {
    const columns = (candidate as DataGridSourceColumnsOwner | undefined)?.[DATA_GRID_SOURCE_COLUMNS];
    if (!Array.isArray(columns)) {
      continue;
    }
    const flatten = (items: HTMLRevoGridElement['columns']): ColumnRegular[] =>
      items.flatMap((column) => ('children' in column ? flatten(column.children) : [column]));
    return flatten(columns);
  }
  return [];
}
