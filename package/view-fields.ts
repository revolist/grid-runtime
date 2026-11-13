import type { ColumnProp } from '@revolist/revogrid';

/** Shared semantic field names used by data-backed Pro views. */
export interface ViewFieldMap {
  readonly id?: ColumnProp;
  readonly title?: ColumnProp;
  readonly status?: ColumnProp;
  readonly start?: ColumnProp;
  readonly end?: ColumnProp;
  readonly color?: ColumnProp;
  readonly progress?: ColumnProp;
  readonly resourceId?: ColumnProp;
}
