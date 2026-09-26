// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// `astro build` / `astro check` pre-bundle production React into Vite's cache.
// Sharing that cache with a running `astro dev` makes islands crash on hydration
// ("_jsxDEV is not a function"), so the dev server gets its own directory.
const isDev = process.argv.includes('dev');

// https://astro.build/config
export default defineConfig({
  site: 'https://netwagetax.com',

  vite: {
    plugins: [tailwindcss()],
    cacheDir: isDev ? 'node_modules/.vite-dev' : 'node_modules/.vite'
  },

  integrations: [react()]
});