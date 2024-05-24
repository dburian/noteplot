<script>
  import { goto } from '$app/navigation';
  import { createEventDispatcher } from 'svelte';

  export let container;
  export let graphDisplayed;
  export let viewedNote;
  export let graphFullScreen;

  const dispatch = createEventDispatcher();

  let toolbar;
  let slider;

  const mouseMove = (event) => {
    slider.style.cssText = `position: absolute;top: ${event.clientY - slider.clientHeight/2}px; left: ${event.clientX - slider.clientWidth/2}px;`
    dispatch('sliderMove', {
      x: Math.max(
        Math.min(container.clientWidth - toolbar.clientWidth, event.clientX - toolbar.clientWidth / 2),
        0
      )
    });
  }

  const onSliderMousedown = (event) => {
    goto(window.location.pathname, {replaceState: true})
    mouseMove(event)
    container.addEventListener('mousemove', mouseMove);
    container.addEventListener('mouseup', () => {
      container.removeEventListener('mousemove', mouseMove);
      if (slider !== null) {
        slider.style = "";
      }
    });
  }
</script>

<div class="h-screen grid auto-rows-max gap-y-4 p-4" bind:this={toolbar}>
  {#if viewedNote}
    <div class="sep-button" on:click={() => goto('/')}>x</div>
  {/if}
  {#if viewedNote && graphDisplayed}
    <div class="sep-button" on:click={() => graphFullScreen ? goto(viewedNote.slug) : goto(`/notes/${viewedNote.slug}`)}>{'<'}</div>
  {/if}
  {#if viewedNote && !graphFullScreen}
    <div class="sep-button" on:click={() => goto(`/${viewedNote.slug}${graphDisplayed ? "?graphFullScreen" : ""}`)}>{'>'}</div>
  {/if}
  {#if viewedNote && graphDisplayed}
    <div class="sep-button" bind:this={slider} on:mousedown={onSliderMousedown}>{'<->'}</div>
  {/if}
</div>

<style>
  .sep-button {
    width: 40px;
    height: 40px;
    display: grid;
    align-content: center;
    cursor: pointer;
    text-align: center;
    background: black;
    color: white;
    font-weight: bold;
    z-index: 10;
    user-select: none;
  }

  .sep-button:hover {
    color: black;
    background: white;
    border: 2px solid black;
  }
</style>
