import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// base MUST match the GitHub repository name, otherwise GitHub Pages serves
// the HTML but every asset URL 404s and the page renders blank.
// Live URL: https://ayyzac.github.io/real-life-sim/
export default defineConfig({
  base: '/real-life-sim/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
