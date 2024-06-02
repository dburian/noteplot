<script>
    import { onMount } from "svelte";

  const minWidth = 95;
  let width = minWidth;
  let maxBorder = 2;
  let border = maxBorder;


  function onScroll() {
    const height = document.body.clientHeight
    const scroll = window.scrollY;

    const fullScroll = height/10;
    const progress = Math.min(1, scroll/fullScroll)

    width = minWidth + (100 - minWidth) * progress
    border = (1 - progress) * maxBorder;
  }

  onMount(() => {
    document.addEventListener("scroll", onScroll);

    onScroll()

    return () => {
      document.removeEventListener("scroll", onScroll);
    }
  })
</script>


<div
  class="relative top-[-100px] border-black shadow-hover bg-white z-50"
  style={`width: ${width}%; margin: 0 ${(100-width)/2}%; border-width: ${border}px`}
>
  <slot />
</div>
<div class="fixed" />
