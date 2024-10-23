<script>
  import { getContext, onMount } from 'svelte';
    import ToolbarButton from '../ToolbarButton.svelte';

  const giState = getContext('graphInterfaceState');
  /** @type {HTMLButtonElement} */
  let resizeButton;

  function mousedown() {
    document.body.addEventListener('mousemove', mousemove);
    document.body.addEventListener('mouseup', mouseup);
    document.body.addEventListener('mouseleave', mouseup);
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
  <div class="relative left-[-50%] mt-4">
    <ToolbarButton bind:button={resizeButton} sizeClasses="w-2 h-2" />
  </div>
</div>
