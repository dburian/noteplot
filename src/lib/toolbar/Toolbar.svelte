<script>
  export let toolbar;
</script>

<div
  class='h-screen grid auto-rows-max gap-y-4 p-4'
  bind:this={toolbar}
>
  <slot />
</div>
