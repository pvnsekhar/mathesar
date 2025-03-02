<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { router } from 'tinro';

  import { iconDeleteMajor, iconExploration } from '@mathesar/icons';
  import { getSchemaPageUrl } from '@mathesar/routes/urls';
  import { confirmDelete } from '@mathesar/stores/confirmation';
  import { databasesStore } from '@mathesar/stores/databases';
  import { currentSchema } from '@mathesar/stores/schemas';
  import { getTabularDataStoreFromContext } from '@mathesar/stores/table-data';
  import { deleteTable } from '@mathesar/stores/tables';
  import {
    constructDataExplorerUrlToSummarizeFromGroup,
    createDataExplorerUrlToExploreATable,
  } from '@mathesar/systems/data-explorer';
  import {
    AnchorButton,
    Button,
    Help,
    Icon,
    iconExternalLink,
  } from '@mathesar-component-library';

  import TableDeleteConfirmationBody from './TableDeleteConfirmationBody.svelte';

  const tabularData = getTabularDataStoreFromContext();
  const { currentDatabase } = databasesStore;

  $: ({ table, columnsDataStore, meta } = $tabularData);
  $: ({ grouping } = meta);
  $: ({ columns } = columnsDataStore);
  $: explorationPageUrl =
    $currentDatabase && $currentSchema
      ? createDataExplorerUrlToExploreATable(
          $currentDatabase?.id,
          $currentSchema.oid,
          table,
        )
      : '';
  $: summarizationUrl = (() => {
    if (!$currentDatabase || !$currentSchema) {
      return undefined;
    }
    return constructDataExplorerUrlToSummarizeFromGroup(
      $currentDatabase.id,
      $currentSchema.oid,
      {
        baseTable: table,
        columns: $columns,
        terseGrouping: $grouping.terse(),
      },
    );
  })();

  function handleDeleteTable() {
    void confirmDelete({
      identifierType: $_('table'),
      body: {
        component: TableDeleteConfirmationBody,
        props: {
          tableName: table.name,
        },
      },
      onProceed: async () => {
        // TODO handle error when deleting
        // TODO: Get db and schema from prop or context
        const database = $currentDatabase;
        const schema = $currentSchema;
        if (database && schema) {
          await deleteTable(database, schema, table.oid);
          router.goto(getSchemaPageUrl(database.id, schema.oid), true);
        }
      },
    });
  }
</script>

<div class="actions-container">
  {#if $currentDatabase && $currentSchema}
    <AnchorButton href={explorationPageUrl}>
      <div class="action-item">
        <div>
          <Icon {...iconExploration} /> <span>{$_('explore_data')}</span>
          <Help>
            {$_('open_table_in_data_explorer')}
          </Help>
        </div>
        <Icon {...iconExternalLink} />
      </div>
    </AnchorButton>
    {#if summarizationUrl}
      <AnchorButton href={summarizationUrl}>
        <div class="action-item">
          <div>
            <Icon {...iconExploration} />
            <span>{$_('summarize_in_data_explorer')}</span>
            <Help>
              {$_('summarize_in_data_explorer_help')}
            </Help>
          </div>
          <Icon {...iconExternalLink} />
        </div>
      </AnchorButton>
    {/if}
  {/if}

  <Button appearance="outline-primary" on:click={handleDeleteTable}>
    <Icon {...iconDeleteMajor} />
    <span>{$_('delete_table')}</span>
  </Button>
</div>

<style lang="scss">
  .actions-container {
    display: flex;
    flex-direction: column;

    > :global(* + *) {
      margin-top: 0.5rem;
    }
  }

  .action-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
