<script>
  import { createEventDispatcher, getContext } from 'svelte';
  import ToolbarButton from '../ToolbarButton.svelte';

  const giState = getContext('graphInterfaceState');
  const dispatcher = createEventDispatcher();
</script>

{#if $giState.search === null}
  <ToolbarButton
    on:click={() => {
      giState.update({
        search: '',
        viewedNote: null,
        graphFullScreen: false
      });
      dispatcher('click');
    }}
  >
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 136 137"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clip-path="url(#clip0_5_3)">
        <rect x="61" y="10" width="65" height="65" stroke-width="20" />
        <line x1="58.0711" y1="78.0711" x2="7.07107" y2="129.071" stroke-width="20" />
      </g>
      <defs>
        <clipPath id="clip0_5_3">
          <rect width="136" height="137" fill="white" />
        </clipPath>
      </defs>
    </svg>
  </ToolbarButton>
{/if}
