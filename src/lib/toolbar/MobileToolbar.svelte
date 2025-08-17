<script>
  import { getContext } from 'svelte';
  import ToolbarButton from './ToolbarButton.svelte';
  import Search from './buttons/Search.svelte';
  import CloseContent from './buttons/CloseContent.svelte';

  const giState = getContext('graphInterfaceState');

  let opened = false;

  let originalStyle = '';
  function toggle() {
    if (!opened) {
      //TODO: scroll lock
      //originalStyle = document.body.style
      //document.body.style = "
    }
  }

  function gotoGraph() {}

  function close() {
    opened = false;
  }

  const graphState = getContext('graphState');
  const contentState = getContext('contentState');
</script>

{#if opened}
  <div class="fixed top-0 left-0 h-screen w-screen bg-white dark:bg-neutral-800 z-50">
    <div class="inline-grid w-full tmp p-8 justify-center gap-8 justify-items-center">
      <ToolbarButton
        on:click={close}
        activeColor="bg-sky-600 dark:bg-sky-500"
        defaultColor="bg-sky-800 dark:bg-sky-700"
        class={'w-8 h-8'}
      >
        -
      </ToolbarButton>
      <!-- <Search on:click={close} /> -->
      <CloseContent on:click={close} />
    </div>
  </div>
{/if}

<div class="fixed bottom-4 right-2 z-40">
  <div class="grid gap-2">
    {#if $graphState.activeNote !== null}
      {#if !$contentState.noContent}
        <ToolbarButton
          on:click={() => contentState.noContent()}
          activeColor="bg-sky-600 dark:bg-sky-500"
          defaultColor="bg-sky-800 dark:bg-sky-700"
          class={'w-8 h-8'}
        >
          {'g'}
        </ToolbarButton>
      {:else}
        <ToolbarButton
          on:click={() => contentState.onlyContent()}
          activeColor="bg-sky-600 dark:bg-sky-500"
          defaultColor="bg-sky-800 dark:bg-sky-700"
          class={'w-8 h-8'}
        >
          {'n'}
        </ToolbarButton>

      {/if}
    {/if}
    <ToolbarButton
      on:click={() => (opened = !opened)}
      activeColor="bg-sky-600 dark:bg-sky-500"
      defaultColor="bg-sky-800 dark:bg-sky-700"
      class={'w-8 h-8'}
    >
      {'+'}
    </ToolbarButton>
  </div>
</div>

<style>
  .tmp {
    grid-template-columns: repeat(auto-fit, minmax(3rem, 1fr));
  }
</style>
