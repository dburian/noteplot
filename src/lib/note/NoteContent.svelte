<script>
  import Prose from '$lib/Prose.svelte';
  import { hasContext } from 'svelte';
    import WithHoverableLinks from './WithHoverableLinks.svelte';

  export let slug, title, links, backlinks, content, noteRoot, images, matter;
</script>

<svelte:head>
  <title>Noteplot | {title}</title>
</svelte:head>

<div class="w-full grid justify-center p-3 sm:p-6">
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

    <h2>Frontmatter</h2>
    <ul>
      {#each Object.keys(matter) as key}
        <li>{key}: {matter[key]}</li>
      {/each}
    </ul>

    <hr />

    {#if hasContext('graphState')}
      <WithHoverableLinks>
        {@html content}
      </WithHoverableLinks>
    {:else}
      {@html content}
    {/if}

    <style>
      mjx-container[jax='SVG'] {
        display: inline-block;
        vertical-align: middle;
        overflow: auto;
      }
      mjx-container[jax='SVG'][display='true'] {
        display: grid;
        justify-items: center;
      }
    </style>
  </Prose>
</div>

<style>
  @media (prefers-color-scheme: dark) {
    :global(.shiki),
    :global(.shiki span) {
      color: var(--shiki-dark) !important;
      background-color: var(--shiki-dark-bg) !important;
      /* Optional, if you also want font styles */
      font-style: var(--shiki-dark-font-style) !important;
      font-weight: var(--shiki-dark-font-weight) !important;
      text-decoration: var(--shiki-dark-text-decoration) !important;
    }
  }
  :global(pre) {
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
