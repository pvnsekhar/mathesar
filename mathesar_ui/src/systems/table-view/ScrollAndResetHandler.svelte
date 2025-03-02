<script lang="ts">
  import { beforeUpdate, tick } from 'svelte';

  import type { States } from '@mathesar/api/rest/utils/requestUtils';
  import type { SheetVirtualRowsApi } from '@mathesar/components/sheet/types';
  import {
    Filtering,
    Grouping,
    type Row,
    Sorting,
    getTabularDataStoreFromContext,
  } from '@mathesar/stores/table-data';
  import type Pagination from '@mathesar/utils/Pagination';

  const tabularData = getTabularDataStoreFromContext();

  $: ({ recordsData, display, meta } = $tabularData);
  $: ({ newRecords, state } = recordsData);
  $: ({ sorting, filtering, grouping, pagination } = meta);
  $: ({ displayableRecords } = display);

  export let api: SheetVirtualRowsApi;

  let initialSorting: Sorting;
  let initialFiltering: Filtering;
  let initialGrouping: Grouping;
  let initialPagination: Pagination;

  beforeUpdate(() => {
    initialSorting = $sorting;
    initialFiltering = $filtering;
    initialGrouping = $grouping;
    initialPagination = $pagination;
  });

  $: {
    if (
      initialSorting !== $sorting ||
      initialFiltering !== $filtering ||
      initialGrouping !== $grouping ||
      initialPagination !== $pagination
    ) {
      api.scrollToTop();
    }
  }

  let previousNewRecordsCount = 0;
  let previousAllRecordsCount = 0;
  let prevGrouping: Grouping;
  let prevRecordState: States;

  async function resetIndex(_recordState: States, _displayableRecords: Row[]) {
    if (
      prevGrouping !== $grouping ||
      ($grouping.entries.length > 0 && prevRecordState !== _recordState)
    ) {
      await tick();
      // Reset if grouping is active
      api.recalculateHeightsAfterIndex(0);
      prevGrouping = $grouping;
      prevRecordState = _recordState;
      return;
    }

    const allRecordCount = _displayableRecords.length ?? 0;
    const newRecordCount = $newRecords.length ?? 0;
    if (previousNewRecordsCount !== newRecordCount) {
      const index = Math.max(
        previousAllRecordsCount - previousNewRecordsCount - 3,
        0,
      );
      await tick();
      if (previousNewRecordsCount < newRecordCount) {
        api.scrollToBottom();
      }
      previousNewRecordsCount = newRecordCount;
      previousAllRecordsCount = allRecordCount;
      api.recalculateHeightsAfterIndex(index);
    }
  }

  $: void resetIndex($state, $displayableRecords);
</script>
