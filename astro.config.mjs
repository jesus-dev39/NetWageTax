// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// `astro build` / `astro check` pre-bundle production React into Vite's cache.
// Sharing that cache with a running `astro dev` makes islands crash on hydration
// ("_jsxDEV is not a function"), so the dev server gets its own directory.
const isDev = process.argv.includes('dev');

// https://astro.build/config
export default defineConfig({
  site: 'https://netwagetax.com',

  // Canonical URLs end in a slash (/state-taxes/california/). vercel.json redirects
  // slashless requests to them, so keep every internal link slash-terminated.
  trailingSlash: 'always',

  // The directory moved from /states; keep old links and bookmarks working.
  redirects: {
    '/states': '/state-taxes/',
  },

  vite: {
    plugins: [tailwindcss()],
    cacheDir: isDev ? 'node_modules/.vite-dev' : 'node_modules/.vite'
  },

  integrations: [react(), sitemap()]
});