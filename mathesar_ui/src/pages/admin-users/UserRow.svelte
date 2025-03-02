<script lang="ts">
  import { getEditUsersPageUrl } from '@mathesar/routes/urls';
  import type { UserModel } from '@mathesar/stores/users';
  import { getUserTypeInfoFromUserModel } from '@mathesar/systems/users-and-permissions';
  import { Icon } from '@mathesar-component-library';

  export let user: UserModel;

  $: userTypeInfo = getUserTypeInfoFromUserModel(user);
  $: showUserDetailedInfo = user.email || user.fullName;
</script>

<a class="user-row passthrough" href={getEditUsersPageUrl(user.id)}>
  <div class="user-info">
    <span>{user.username}</span>
    {#if showUserDetailedInfo}
      <div class="user-detailed-info">
        {#if user.fullName}
          <span>{user.fullName}</span>
        {/if}
        {#if user.fullName && user.email}
          <span class="divider" />
        {/if}
        {#if user.email}
          <span>{user.email}</span>
        {/if}
      </div>
    {/if}
  </div>
  <div class="user-type">
    <Icon {...userTypeInfo.icon} size="0.9rem" />
    <span>{userTypeInfo.displayName}</span>
  </div>
</a>

<style lang="scss">
  .user-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--size-x-small);
    cursor: pointer;
    min-height: 4.2rem;

    &:hover {
      background: var(--slate-50);
    }
    &:focus {
      background: var(--slate-100);
    }
  }

  .user-info {
    display: flex;
    flex-direction: column;

    > :global(* + *) {
      margin-top: 0.25rem;
    }
  }

  .user-detailed-info {
    display: flex;
    align-items: center;

    font-weight: 300;

    > :global(* + *) {
      margin-left: 0.5rem;
    }
  }

  .divider {
    display: inline-block;
    width: 0.25rem;
    height: 0.25rem;
    background-color: var(--slate-500);
    border-radius: 50%;
  }

  .user-type {
    background-color: var(--slate-200);
    padding: 0.25rem 0.5rem;
    border-radius: 1.17rem;
    font-size: var(--text-size-small);
  }
</style>
