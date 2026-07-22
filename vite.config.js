import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Renderer-scoped Vite build for the Electron app.
// - root is src/renderer so index.html + main.jsx live beside the components.
// - base MUST be './' so the built index.html references ./assets/* relatively,
//   which is required for the packaged app that loads it over file:// from inside
//   the asar (build/renderer/index.html).
// - outDir is build/renderer (repo root), deliberately NOT dist/ — electron-builder
//   owns dist/, and a collision would make it package the wrong tree.
export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'build/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5123,
    strictPort: true,
  },
});
