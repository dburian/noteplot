<script>
  /**
   * Text with its matched runs in `<strong>` — the result row's title, tags
   * and snippet. Inline: no wrapper element, so it inherits the line's
   * truncation and clamping.
   *
   * The markup's layout is load-bearing. Svelte collapses a run of whitespace
   * in a text node to a single space, so putting `{#each}`, `{#if}` and
   * `</strong>` on tidy separate lines renders "convexity" as "convex ity";
   * the only line break is inside the `</strong\n>` tag, where it is harmless.
   * And **no comment above it** — not even `prettier-ignore`: a comment and
   * its newline render as a leading space, so tags read `# math`. Verify with
   * `svelte.compiler.compile(src, {generate: 'ssr'})` if you touch it.
   * Text only, never `{@html}`: this is note text.
   */

  /** @type {import('./snippet.js').SnippetPart[]} */
  export let parts;

  /** A literal class string, so Tailwind's scanner sees it at the call site. */
  export let strongClass = 'font-semibold text-front-light dark:text-front-dark';
</script>

{#each parts as part}{#if part.match}<strong class={strongClass}>{part.text}</strong
    >{:else}{part.text}{/if}{/each}
