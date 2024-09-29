
<article
  class="
max-w-prose prose dark:prose-invert prose-h1:text-2xl prose-h2:text-xl
prose-h3:text-lg prose-h4:text-base prose-a:underline prose-p:text-justify
prose-img:rounded-xl prose-headings:my-4 prose-headings:font-bold
prose-headings:text-xl overflow-auto"
>
<slot />
</article>

<style>
  @media (prefers-color-scheme: dark) {
    :global(.shiki), :global(.shiki span) {
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
