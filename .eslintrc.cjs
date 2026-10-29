/** @type { import("eslint").Linter.Config } */
module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:svelte/recommended', 'prettier'],
  parserOptions: {
    sourceType: 'module',
    // 2022, not 2020: both `NotesUpdater` and `GraphRenderer` use class
    // fields (`flush_events = async () => {}`), which 2020 cannot parse --
    // eslint reported it as "Unexpected token =" and skipped both files whole.
    ecmaVersion: 2022,
    extraFileExtensions: ['.svelte']
  },
  rules: {
    // `_` is the name for a binding that exists only because the syntax needs
    // one -- `for (const _ of Array(n))`, counting loops in the renderer.
    'no-unused-vars': ['error', { varsIgnorePattern: '^_$', argsIgnorePattern: '^_' }]
  },
  env: {
    browser: true,
    es2022: true,
    node: true
  }
};
