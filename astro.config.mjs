// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, envField } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://juntae-weblog.netlify.app/',
  output: 'static',
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    schema: {
      NOTION_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      NOTION_DATABASE_ID: envField.string({
        context: 'server',
        access: 'public',
      }),
    },
  },
});
