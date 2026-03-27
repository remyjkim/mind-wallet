import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const packageVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

export default defineConfig({
  entry: { index: 'src/index.ts', cli: 'src/cli.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  define: {
    __MINDPASS_VERSION__: JSON.stringify(packageVersion),
  },
  noExternal: ['@mindpass/core', '@mindpass/discovery', '@mindpass/protocols'],
  // Native NAPI-RS bindings must not be bundled
  external: ['@open-wallet-standard/core'],
});
