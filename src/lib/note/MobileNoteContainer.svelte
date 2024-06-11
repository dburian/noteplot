<script>
  import { getContext } from "svelte";

  const heightThresholds = [0, 0.2, 1]
  const maxOpened = heightThresholds.length - 1
  let opened = 1;

  let container;
  let startPointer;
  let heightOffset = 0;
  let scrollEnabled = false;

  function totalHeight(opened, heightOffset) {
    let baseHeight = 0;
    if (typeof window !== "undefined") {
      baseHeight = heightThresholds[opened] * window.innerHeight
    }

    const total = Math.max(0, Math.min(baseHeight + heightOffset, window.innerHeight))

    return total;
  }

  function pointerDown(event) {
    container.addEventListener("pointerup", pointerUp)
    container.addEventListener("pointermove", pointerMove)


    startPointer = {x: event.clientX, y: event.clientY};
  }

  function pointerUp(event) {
    container.removeEventListener("pointerup", pointerUp)
    container.removeEventListener("pointermove", pointerMove)

    const click = Math.abs(event.clientY - startPointer.y) < 10 && Math.abs(event.clientX - startPointer.x) < 10


    if (click && opened < maxOpened) {
      opened = maxOpened
    } else if (click && opened == maxOpened) {
      opened = 1
    } else {
      const pointerHeight = 1 - event.clientY / window.innerHeight;

      if (pointerHeight > 0.5) {
        opened = maxOpened
      } else {
        opened = 1
      }
    }

    heightOffset = 0

    if (opened === maxOpened) {
      scrollEnabled = true;
    }
  }

  function pointerMove(event) {
    //User is scrolling
    if (container.scrollTop > 0) {
      return;
    }

    const moveBy = startPointer.y - event.clientY;
    const finalHeight = totalHeight(opened, moveBy)

    // Note is fully open, should scroll now
    if (finalHeight >= window.innerHeight) {
      scrollEnabled = true;
      opened = maxOpened;
      heightOffset = 0;
      return;
    }

    event.preventDefault()
    scrollEnabled = false;
    heightOffset = moveBy;
  }


  $: height = totalHeight(opened, heightOffset);

  const giState = getContext("graphInterfaceState")
</script>

{#if $giState.viewedNote}
<div
  class={`${scrollEnabled ? "overflow-auto" : "overflow-hidden"} fixed shadow-hover bg-white z-10 w-full touch-none`}
  style={`margin-top:-${height}px;height: ${height}px`}
  bind:this={container}
  on:pointerdown={pointerDown}
>
  <div class="w-1/4 mx-auto my-2 border-2 border-black" />
  <div class={`w-full ${scrollEnabled ? "touch-auto" : "touch-none"}`}>
    <slot />
  </div>
</div>
{/if}

<style>
:global(html, body) {
    overscroll-behavior-y: none;
}
</style>
