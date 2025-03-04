<article
  class="prose prose-noteplot dark:prose-invert overflow-auto
  prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base
  prose-headings:my-4 prose-headings:font-bold prose-p:text-justify
  prose-img:rounded-xl prose-code:font-normal max-w-none"
>
  <slot />
</article>

<style>
  :global(.prose-high-level-tag) {
    max-width: 65ch;
    margin: auto;
  }
</style>
