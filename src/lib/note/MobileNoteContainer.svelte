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
    container.addEventListener("pointerup", pointerUp, true)
    container.addEventListener("pointermove", pointerMove, true)


    startPointer = {x: event.clientX, y: event.clientY};
  }

  function pointerUp(event) {
    container.removeEventListener("pointerup", pointerUp, true)
    container.removeEventListener("pointermove", pointerMove, true)

    const pointerHeight = 1 - event.clientY / window.innerHeight;

    if (pointerHeight > 0.5) {
      opened = maxOpened
    } else {
      opened = 1
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

  function toggle() {
    if (opened < maxOpened) {
      opened = maxOpened
    } else if (opened == maxOpened) {
      opened = 1
    }
  }



  $: height = totalHeight(opened, heightOffset);

  const giState = getContext("graphInterfaceState")
</script>

{#if $giState.withContent}
<div
  class={`${scrollEnabled ? "overflow-auto" : "overflow-hidden"} fixed bottom-0 ${window && height < window.innerHeight ? "border-t-2" : ""} border-black bg-white z-10 w-full touch-none`}
  style={`margin-top:-${height}px;height: ${height}px`}
  bind:this={container}
  on:pointerdown={pointerDown}
>
  <button class="w-1/4 mx-auto block my-2 border-2 border-black" on:click={toggle} />
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
