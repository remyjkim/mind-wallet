import { defineConfig } from 'vitest/config';
import path from 'path';
import { readFileSync } from 'node:fs';

const packageVersion = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version;

export default defineConfig({
  define: {
    __MINDWALLET_VERSION__: JSON.stringify(packageVersion),
  },
  resolve: {
    alias: {
      '@mindwallet/core': path.resolve(__dirname, '../core/src/index.ts'),
      '@mindwallet/protocols': path.resolve(__dirname, '../protocols/src/index.ts'),
      '@mindwallet/discovery': path.resolve(__dirname, '../discovery/src/index.ts'),
    },
  },
  test: {
    globals: true,
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 20_000,
    server: {
      deps: {
        // NAPI-RS native bindings cannot be bundled by Vite — must be loaded from node_modules
        external: ['@open-wallet-standard/core'],
      },
    },
  },
});
