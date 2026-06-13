import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/bin.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  dts: false,
  exports: { bin: false },
  hash: false,
  outExtensions: () => ({ js: '.js' }),
  outputOptions: {
    codeSplitting: false,
  },
});
