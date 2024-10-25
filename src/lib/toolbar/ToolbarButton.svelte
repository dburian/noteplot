<script>
  export let button;
  export let sizeClasses;
</script>

<button
  on:click
  on:mousedown
  bind:this={button}
  class={`${sizeClasses} ` +
  `grid content-center border-2 font-bold border-front-light p-2 select-none ` +
  `text-base sm:text-sm ` +
  // Normal
  `bg-back-light text-front-light ` +
  // Dark normal
  `dark:bg-back-dark dark:text-front-dark dark:border-front-dark ` +
  // Hover
  `hover:bg-front-light hover:text-back-light ` +
  // Dark hover
  `dark:hover:bg-front-dark dark:hover:text-back-dark ` +
  // Svg normal and hover
  `stroke-front-light hover:stroke-back-light `+
  // Dark svg normal and hover
  `dark:stroke-front-dark  hover:dark:stroke-back-dark  `}
>
  <slot />
</button>
