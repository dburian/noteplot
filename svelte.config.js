import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  kit: {
    adapter: adapter({
      // default options are shown. On some platforms
      // these options are set automatically — see below
      pages: 'build',
      assets: 'build',
      fallback: undefined,
      precompress: false,
      strict: true
    }),
    prerender: {
      handleHttpError: 'warn',
    },
    paths: {
      base: "BASE_PATH" in process.env ? process.env.BASE_PATH : '',
      relative: false,
    }
  },
  preprocess: vitePreprocess(),
};
