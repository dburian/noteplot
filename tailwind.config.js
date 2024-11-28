
import typography from "@tailwindcss/typography"
import colors from "tailwindcss/colors";

//Copied over from typography plugin
/** @param {string} hex */
const hexToRgb = (hex) => {
  hex = hex.replace('#', '')
  hex = hex.length === 3 ? hex.replace(/./g, '$&$&') : hex
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `${r} ${g} ${b}`
}

// Noteplot colors
const nc = {
  front: {
    light: colors.zinc[700],
    dark: colors.zinc[300],
  },
  back: {
    light: colors.white,
    dark: colors.zinc[950],
  },
  emphasis: {
    light: colors.zinc[900],
    dark: colors.white,
  },
  muted: {
    light: colors.zinc[400],
    dark: colors.zinc[600],
  }
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: nc,
      typography: {
        DEFAULT: {
          css: {
            'code::before': {
              content: ''
            },
            'code::after': {
              content: ''
            },
          }
        },
        // My theme, slightly changed 'zinc' theme.
        noteplot: {
          css: {
            '--tw-prose-body': nc.front.light,
            '--tw-prose-headings': nc.emphasis.light,
            '--tw-prose-lead': colors.zinc[600],
            '--tw-prose-links': nc.front.light,
            '--tw-prose-bold': nc.emphasis.light,
            '--tw-prose-counters': colors.zinc[500],
            '--tw-prose-bullets': nc.muted.light,
            '--tw-prose-hr': colors.zinc[200],
            '--tw-prose-quotes': nc.emphasis.light,
            '--tw-prose-quote-borders': colors.zinc[200],
            '--tw-prose-captions': colors.zinc[500],
            '--tw-prose-kbd': nc.emphasis.light,
            '--tw-prose-kbd-shadows': hexToRgb(nc.emphasis.light),
            '--tw-prose-code': nc.emphasis.light,
            '--tw-prose-pre-code': colors.zinc[200],
            '--tw-prose-pre-bg': colors.zinc[800],
            '--tw-prose-th-borders': nc.muted.light,
            '--tw-prose-td-borders': colors.zinc[200],
            '--tw-prose-invert-body': nc.front.dark,
            '--tw-prose-invert-headings': nc.emphasis.dark,
            '--tw-prose-invert-lead': colors.zinc[400],
            '--tw-prose-invert-links': nc.front.dark,
            '--tw-prose-invert-bold': nc.emphasis.dark,
            '--tw-prose-invert-counters': colors.zinc[400],
            '--tw-prose-invert-bullets': nc.muted.dark,
            '--tw-prose-invert-hr': colors.zinc[700],
            '--tw-prose-invert-quotes': colors.zinc[100],
            '--tw-prose-invert-quote-borders': colors.zinc[700],
            '--tw-prose-invert-captions': colors.zinc[400],
            '--tw-prose-invert-kbd': nc.emphasis.dark,
            '--tw-prose-invert-kbd-shadows': hexToRgb(nc.emphasis.dark),
            '--tw-prose-invert-code': nc.emphasis.dark,
            '--tw-prose-invert-pre-code': colors.zinc[300],
            '--tw-prose-invert-pre-bg': 'rgb(0 0 0 / 50%)',
            '--tw-prose-invert-th-borders': nc.muted.dark,
            '--tw-prose-invert-td-borders': colors.zinc[700],
          },
        },
      }

    },
  },
  plugins: [
    typography,
  ],
}
