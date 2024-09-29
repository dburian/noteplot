<script>
    import Prose from "$lib/Prose.svelte";


  export let slug, title, links, backlinks, content, noteRoot, images;
</script>

<svelte:head>
    <title>Noteplot | {title} </title> 
</svelte:head>
<div class="article-container w-full grid justify-center p-3 sm:p-6">
  <Prose>
    <h1>{title}</h1>
    <h2>Forward links</h2>
    <ul>
      {#each links as link}
        <li><a href={`./${link.slug}`}>{link.title}</a></li>
      {/each}
    </ul>
    <h2>Backward links</h2>
    <ul>
      {#each backlinks as link}
        <li><a href={`./${link.slug}`}>{link.title}</a></li>
      {/each}
    </ul>

    <hr />

    {@html content}
  </Prose>
  <style>
    mjx-container[jax="SVG"] {
      display: inline-block;
      vertical-align: middle;
      overflow: auto;
    }
    mjx-container[jax="SVG"][display="true"] {
      display: grid;
      justify-items: center;
    }
  </style>
</div>
