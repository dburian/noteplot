<script>
  import Prose from '$lib/Prose.svelte';
  import WithHoverableLinks from './WithHoverableLinks.svelte';
  import NoteHeader from './NoteHeader.svelte';

  /**
   * One note's rendered body.
   *
   * It does **not** set `document.title`. Several of these are mounted at once
   * — one per column — and they would fight over it; `content/ContentPane.svelte`
   * owns the title and derives it from the focused tile.
   *
   * **One `note` prop, not a spread of its fields.** Every call site has the
   * whole note JSON and used to `{...note}` it in, which meant declaring a prop
   * per key — including `title` and `path`, which nothing here renders.
   * Undeclared keys in a
   * spread produce an "unknown prop" warning per note; declared-and-unused ones
   * produce a compiler warning. Taking the object sidesteps both.
   *
   * @type {import('$lib/notes_route.js').Note}
   */
  export let note;
</script>

<div class="w-full grid justify-center p-3 sm:p-6">
  <Prose>
    <WithHoverableLinks>
      <NoteHeader {note} />
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html note.html}
    </WithHoverableLinks>

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
