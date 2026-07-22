import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Inject a strict Content-Security-Policy into the BUILT index.html only.
// Not applied to the dev server, where Vite injects an inline react-refresh
// preamble that a strict script-src would block. In production every script is
// an external ./assets bundle (module-preload polyfill is disabled below, since
// Electron's Chromium supports modulepreload natively), so 'self' suffices.
// style-src needs 'unsafe-inline' because xterm injects inline styles.
const PROD_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self' data:; connect-src 'self';";

const injectCsp = {
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      '</head>',
      `    <meta http-equiv="Content-Security-Policy" content="${PROD_CSP}" />\n  </head>`
    );
  },
};

// Renderer-scoped Vite build for the Electron app.
// - root is src/renderer so index.html + main.jsx live beside the components.
// - base MUST be './' so the built index.html references ./assets/* relatively,
//   which is required for the packaged app that loads it over file:// from inside
//   the asar (build/renderer/index.html).
// - outDir is build/renderer (repo root), deliberately NOT dist/ — electron-builder
//   owns dist/, and a collision would make it package the wrong tree.
export default defineConfig({
  plugins: [react(), injectCsp],
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'build/renderer'),
    emptyOutDir: true,
    modulePreload: { polyfill: false },
  },
  server: {
    port: 5123,
    strictPort: true,
  },
});
