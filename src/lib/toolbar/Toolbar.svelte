<script>
  import ToolbarButton from './ToolbarButton.svelte';
  import DesktopToolbarButton from './DesktopToolbarButton.svelte';
  import { goto } from '$app/navigation';
  import { getContext, onMount } from 'svelte';
  import { page } from '$app/stores';

  const urlState = getContext('urlState');
  const giState = getContext('graphInterfaceState');

  /** @type {HTMLButtonElement} */
  let resizeButton;

  function mousedown() {
    document.body.addEventListener('mousemove', mousemove);
    document.body.addEventListener('mouseup', mouseup);
  }

  /**
   * @param {MouseEvent} ev
   *
   * @returns any
   */
  function mousemove(ev) {
    const newContentWidth = 1 - ev.clientX / document.body.clientWidth;
    if (newContentWidth < 0.1) {
      giState.setContentWidth(0);
    } else if (newContentWidth > 0.9) {
      giState.setContentWidth(1);
    } else {
      giState.setContentWidth(newContentWidth);
    }
  }

  function mouseup() {
    giState.confirmContentWidth();
    document.body.removeEventListener('mousemove', mousemove);
  }

  onMount(() => {
    resizeButton.addEventListener('mousedown', mousedown);

    return () => {
      resizeButton.removeEventListener('mousedown', mousedown);
    };
  });
</script>

<div class="absolute">
  <div class="relative left-[-100%] mt-4 mx-4">
    <div class="grid auto-rows-max gap-y-4">
      {#if $urlState.hasContent}
        <DesktopToolbarButton on:click={() => goto('/')}>x</DesktopToolbarButton>
      {/if}
      {#if $urlState.hasContent && !$urlState.fullContent}
        <DesktopToolbarButton on:click={() => giState.largerContent()}>
          {'<'}
        </DesktopToolbarButton>
      {/if}
      {#if $urlState.hasContent && !$urlState.noContent}
        <DesktopToolbarButton on:click={() => giState.smallerContent()}>
          {'>'}
        </DesktopToolbarButton>
      {/if}
      {#if $urlState.searchString === null}
        <DesktopToolbarButton on:click={() => goto('/search?q=')}>
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
        </DesktopToolbarButton>
      {/if}
    </div>
  </div>
  <div class="relative left-[-37.5%] mt-4 mx-4">
    <ToolbarButton bind:button={resizeButton} sizeClasses="w-5 h-5" />
  </div>
</div>
