import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "./tailwind.config.js";

const fullConfig = resolveConfig(tailwindConfig);

const virtualModuleId = "virtual:tailwind-config";
const resolvedVirtualModuleId = "\0" + virtualModuleId;

const precompiledTailwindConfig = {
  name: "tailwind-config-module",
  /** @param {string} id */
  resolveId(id) {
    if (id === virtualModuleId) {
      return resolvedVirtualModuleId;
    }
  },
  /** @param {string} id */
  load(id) {
    if (id === resolvedVirtualModuleId) {
      return `export default ${JSON.stringify(fullConfig, null, 2)}`;
    }
  }
}

export default defineConfig({
  plugins: [sveltekit(), precompiledTailwindConfig]
});
