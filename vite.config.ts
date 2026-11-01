import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the production build also works from a
  // GitHub Pages project sub-path (https://<user>.github.io/<repo>/).
  base: './',
  build: {
    // Phaser is large by design; keep it in its own chunk and silence the size warning.
    chunkSizeWarningLimit: 1600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }],
        },
      },
    },
  },
});
