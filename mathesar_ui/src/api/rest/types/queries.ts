import type { PaginatedResponse } from '@mathesar/api/rest/utils/requestUtils';
import type { Column } from '@mathesar/api/rpc/columns';
import type { Schema } from '@mathesar/api/rpc/schemas';
import type { JoinPath } from '@mathesar/api/rpc/tables';
import type { FilterId } from '@mathesar/stores/abstract-types/types';

export type QueryColumnAlias = string;

/**
 * endpoint: /api/db/v0/queries/<query_id>/
 */

export interface QueryInstanceInitialColumn {
  alias: QueryColumnAlias;
  id: Column['id'];
  jp_path?: JoinPath;
}

// TODO: Extend this to support more complicated filters
// Requires UX reconsideration
type FilterConditionParams = [
  { column_name: [string] },
  ...{ literal: [unknown] }[],
];
type FilterCondition = Partial<Record<FilterId, FilterConditionParams>>;

export interface QueryInstanceFilterTransformation {
  type: 'filter';
  spec: FilterCondition;
}

// This is defined as a value instead of a type because we have a need to
// iterate over it.
export const querySummarizationFunctionIds = [
  'distinct_aggregate_to_array',
  'count',
  'sum',
  'median',
  'mode',
  'percentage_true',
  'max',
  'min',
  'mean',
  'peak_time',
  'peak_month',
] as const;

export type QuerySummarizationFunctionId =
  (typeof querySummarizationFunctionIds)[number];

export interface QueryInstanceSummarizationTransformation {
  type: 'summarize';
  spec: {
    base_grouping_column: string;
    grouping_expressions?: {
      input_alias: string;
      output_alias: string;
      preproc?: string;
    }[];
    aggregation_expressions?: {
      input_alias: string;
      output_alias: string;
      function: QuerySummarizationFunctionId;
    }[];
  };
}

export interface QueryInstanceHideTransformation {
  type: 'hide';
  spec: QueryColumnAlias[];
}

export interface QueryInstanceSortTransformation {
  type: 'order';
  spec: [
    {
      field: string;
      direction: 'asc' | 'desc';
    },
  ];
}

export type QueryInstanceTransformation =
  | QueryInstanceFilterTransformation
  | QueryInstanceSummarizationTransformation
  | QueryInstanceHideTransformation
  | QueryInstanceSortTransformation;

export interface QueryInstance {
  readonly id: number;
  readonly name: string;
  readonly description?: string;
  readonly base_table: number;
  readonly initial_columns?: QueryInstanceInitialColumn[];
  readonly transformations?: QueryInstanceTransformation[];
  readonly display_names: Record<string, string> | null;
}

export interface QueryGetResponse extends QueryInstance {
  readonly schema: number;
}

/**
 * endpoint: /api/db/v0/queries/
 */

export type QueriesList = PaginatedResponse<QueryInstance>;

/**
 * endpoint: /api/db/v0/queries/<query_id>/run/
 */

export interface QueryRunRequest {
  base_table: QueryInstance['base_table'];
  initial_columns: QueryInstanceInitialColumn[];
  transformations?: QueryInstanceTransformation[];
  display_names: QueryInstance['display_names'];
  parameters: {
    order_by?: {
      field: QueryColumnAlias;
      direction: 'asc' | 'desc';
    }[];
    limit: number;
    offset: number;
  };
}

export interface QueryResultColumn {
  alias: string;
  display_name: string | null;
  type: Column['type'];
  type_options: Column['type_options'];
  display_options: Column['display_options'];
}

export interface QueryInitialColumnSource {
  is_initial_column: true;
  input_column_name: string;
  input_table_name: string;
  input_table_id: number;
}

export interface QueryGeneratedColumnSource {
  is_initial_column: false;
  input_alias: string;
}

export type QueryColumnSource =
  | QueryInitialColumnSource
  | QueryGeneratedColumnSource;

export interface QueryInitialColumnMetaData
  extends QueryResultColumn,
    QueryInitialColumnSource {}

export interface QueryVirtualColumnMetaData
  extends QueryResultColumn,
    QueryGeneratedColumnSource {}

export type QueryColumnMetaData =
  | QueryInitialColumnMetaData
  | QueryVirtualColumnMetaData;

/**
 *  TODO: The API always returns empty array for table results,
 * however for queries it returns null. Remove the union once
 * the API is made consistent.
 *
 * Tracked in https://github.com/centerofci/mathesar/issues/1716
 */

export type QueryResultRecord = Record<string, unknown>;

type QueryResultRecords =
  | PaginatedResponse<QueryResultRecord>
  | { count: 0; results: null };

export interface QueryResultsResponse {
  records: QueryResultRecords;
  output_columns: QueryColumnAlias[];
  column_metadata: Record<string, QueryColumnMetaData>;
}

export interface QueryRunResponse extends QueryResultsResponse {
  query: {
    schema: Schema['oid'];
    base_table: QueryInstance['base_table'];
    initial_columns: QueryInstanceInitialColumn[];
    transformations?: QueryInstanceTransformation[];
  };
}
