<script>
  import Prose from '$lib/Prose.svelte';
  import { hasContext } from 'svelte';
  import WithHoverableLinks from './WithHoverableLinks.svelte';
  import NoteMetaContent from './NoteMetaContent.svelte';

  export let slug, title, links, backlinks, content, noteRoot, images, matter, readingTime;

  $: metaProps = {
    title,
    slug,
    links,
    backlinks,
    noteRoot,
    matter,
    readingTime
  };
</script>

<svelte:head>
  <title>Noteplot | {title}</title>
</svelte:head>

<div class="w-full grid justify-center p-3 sm:p-6">
  <Prose>
    {#if hasContext('graphState')}
      <WithHoverableLinks>
        <NoteMetaContent {...metaProps} />
        {@html content}
      </WithHoverableLinks>
    {:else}
      <NoteMetaContent {...metaProps} />
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
