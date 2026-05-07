import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Default to node. Component-render tests opt into jsdom via a per-file
    // `// @vitest-environment jsdom` pragma — see tests/dom/*.dom.test.tsx.
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
