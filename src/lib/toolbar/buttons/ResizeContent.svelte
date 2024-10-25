<script>
  import { getContext} from 'svelte';
  import ToolbarButton from '../ToolbarButton.svelte';

  const contentSlider = getContext('contentSliderState');

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
      contentSlider.setWidth(0);
    } else if (newContentWidth > 0.9) {
      contentSlider.setWidth(1);
    } else {
      contentSlider.setWidth(newContentWidth);
    }
  }

  function mouseup() {
    contentSlider.confirmWidth();
    document.body.removeEventListener('mousemove', mousemove);
  }
</script>

<div class="absolute">
  <div class="relative left-[-50%] mt-4">
    <ToolbarButton on:mousedown={mousedown} class="w-2 h-2" />
  </div>
</div>
