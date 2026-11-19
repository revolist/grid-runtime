import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  root: import.meta.dirname,
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'package/index.ts'),
      name: 'RevoGridRuntime',
      formats: ['umd'],
      fileName: () => 'grid-runtime.umd.cjs',
    },
    rolldownOptions: {
      external: ['@revolist/revogrid'],
      output: { globals: { '@revolist/revogrid': 'Revogrid' } },
    },
  },
});
