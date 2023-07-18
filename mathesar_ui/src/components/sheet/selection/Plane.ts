import { map } from 'iter-tools';

import { cartesianProduct } from '@mathesar/utils/iterUtils';
import { makeCellId, parseCellId } from '../cellIds';
import { Direction, getColumnOffset, getRowOffset } from './Direction';
import type IdSequence from './IdSequence';

function makeCells(
  rowIds: Iterable<string>,
  columnIds: Iterable<string>,
): Iterable<string> {
  return map(
    ([rowId, columnId]) => makeCellId(rowId, columnId),
    cartesianProduct(rowIds, columnIds),
  );
}

/**
 * This describes the different kinds of cells that can be adjacent to a given
 * cell in a particular direction.
 */
export type AdjacentCell =
  | {
      type: 'dataCell';
      cellId: string;
    }
  | {
      type: 'placeholderCell';
      cellId: string;
    }
  | {
      type: 'none';
    };

function noAdjacentCell(): AdjacentCell {
  return { type: 'none' };
}

function adjacentDataCell(cellId: string): AdjacentCell {
  return { type: 'dataCell', cellId };
}

function adjacentPlaceholderCell(cellId: string): AdjacentCell {
  return { type: 'placeholderCell', cellId };
}

export default class Plane {
  readonly rowIds: IdSequence<string>;

  readonly columnIds: IdSequence<string>;

  readonly placeholderRowId: string | undefined;

  constructor(
    rowIds: IdSequence<string>,
    columnIds: IdSequence<string>,
    placeholderRowId: string | undefined,
  ) {
    this.rowIds = rowIds;
    this.columnIds = columnIds;
    this.placeholderRowId = placeholderRowId;
  }

  /**
   * @returns the row id that should be used to represent the given row id in
   * the plane. If the given row id is the placeholder row id, then the last
   * row id in the plane will be returned. Otherwise, the given row id will be
   * returned.
   */
  private normalizeFlexibleRowId(rowId: string): string | undefined {
    if (rowId === this.placeholderRowId) {
      return this.rowIds.last;
    }
    return rowId;
  }

  /**
   * @returns an iterable of all the data cells in the plane. This does not
   * include header cells or placeholder cells.
   */
  allDataCells(): Iterable<string> {
    return makeCells(this.rowIds, this.columnIds);
  }

  /**
   * @returns an iterable of all the data cells in the plane that are in or
   * between the two given rows. This does not include header cells.
   *
   * If either of the provided rows are placeholder rows, then the last data row
   * will be used in their place. This ensures that the selection is made only
   * of data rows, and will never include the placeholder row, even if a user
   * drags to select it.
   */
  dataCellsInFlexibleRowRange(
    rowIdA: string,
    rowIdB: string,
  ): Iterable<string> {
    const a = this.normalizeFlexibleRowId(rowIdA);
    if (a === undefined) {
      return [];
    }
    const b = this.normalizeFlexibleRowId(rowIdB);
    if (b === undefined) {
      return [];
    }
    return makeCells(this.rowIds.range(a, b), this.columnIds);
  }

  /**
   * @returns an iterable of all the data cells in the plane that are in or
   * between the two given columns. This does not include header cells or
   * placeholder cells.
   */
  dataCellsInColumnRange(
    columnIdA: string,
    columnIdB: string,
  ): Iterable<string> {
    return makeCells(this.rowIds, this.columnIds.range(columnIdA, columnIdB));
  }

  /**
   * @returns an iterable of all the data cells in the plane that are in or
   * between the two given cell. This does not include header cells.
   *
   * If either of the provided cells are placeholder cells, then cells in the
   * last row and last column will be used in their place. This ensures that the
   * selection is made only of data cells, and will never include the
   * placeholder cell, even if a user drags to select it.
   */
  dataCellsInFlexibleCellRange(
    cellIdA: string,
    cellIdB: string,
  ): Iterable<string> {
    const cellA = parseCellId(cellIdA);
    const cellB = parseCellId(cellIdB);
    const rowIdA = this.normalizeFlexibleRowId(cellA.rowId);
    if (rowIdA === undefined) {
      return [];
    }
    const rowIdB = this.normalizeFlexibleRowId(cellB.rowId);
    if (rowIdB === undefined) {
      return [];
    }
    const rowIds = this.rowIds.range(rowIdA, rowIdB);
    const columnIds = this.columnIds.range(cellA.columnId, cellB.columnId);
    return makeCells(rowIds, columnIds);
  }

  getAdjacentCell(cellId: string, direction: Direction): AdjacentCell {
    const cell = parseCellId(cellId);

    const columnOffset = getColumnOffset(direction);
    const newColumnId = this.columnIds.offset(cell.columnId, columnOffset);
    if (newColumnId === undefined) {
      return noAdjacentCell();
    }

    if (cell.rowId === this.placeholderRowId) {
      if (direction === Direction.Up) {
        const lastRowId = this.rowIds.last;
        if (lastRowId === undefined) {
          // Can't go up from the placeholder row if there are no data rows
          return noAdjacentCell();
        }
        // Move up from the placeholder row into the last data row
        return adjacentDataCell(makeCellId(lastRowId, newColumnId));
      }
      if (direction === Direction.Down) {
        // Can't go down from the placeholder row
        return noAdjacentCell();
      }
      // Move laterally within the placeholder row
      return adjacentPlaceholderCell(makeCellId(cell.rowId, newColumnId));
    }

    const rowOffset = getRowOffset(direction);
    const newRowId = this.rowIds.offset(cell.rowId, rowOffset);
    if (newRowId === undefined) {
      if (direction === Direction.Down) {
        if (this.placeholderRowId === undefined) {
          // Can't go down from the last data row if there is no placeholder row
          return noAdjacentCell();
        }
        const newCellId = makeCellId(this.placeholderRowId, newColumnId);
        // Move down from the last data row into the placeholder row
        return adjacentPlaceholderCell(newCellId);
      }
      // Can't move up from the first data row
      return noAdjacentCell();
    }

    // Normal movement from one data cell to another data cell
    return adjacentDataCell(makeCellId(newRowId, newColumnId));
  }

  get hasResultRows(): boolean {
    return this.rowIds.length > 0;
  }

  get hasPlaceholder(): boolean {
    return this.placeholderRowId !== undefined;
  }
}
