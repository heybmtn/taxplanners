import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import site from './site.config.ts';

const outDir = process.env.OUT_DIR ?? './dist';
const outPath = fileURLToPath(new URL(outDir.replace(/\/?$/, '/'), import.meta.url));

// Leave noindex pages (fewer than 3 listings, thanks/error pages) out of the sitemap.
function indexable(page) {
  const file = `${outPath}${new URL(page).pathname.slice(1)}index.html`;
  return existsSync(file) && !readFileSync(file, 'utf8').includes('noindex');
}

export default defineConfig({
  site: site.url,
  output: 'static',
  outDir,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  compressHTML: true,
  integrations: [sitemap({ filter: indexable })],
  devToolbar: { enabled: false },
});
