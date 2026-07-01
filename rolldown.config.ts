import { readFileSync } from 'node:fs';
import type { Plugin } from 'rolldown';
import { defineConfig } from 'rolldown';

function htmlPlugin(): Plugin {
  return {
    name: 'html-copy',
    generateBundle() {
      const html = readFileSync('src/homebridge-ui/index.html', 'utf-8');
      const out = html.replace('<script src="./ui.ts"></script>', '<script src="./ui.js"></script>');
      this.emitFile({ type: 'asset', fileName: 'index.html', source: out });
    },
  };
}

export default defineConfig([
  {
    input: 'src/homebridge-ui/server.ts',
    external: ['@homebridge/plugin-ui-utils', /^\.\.\/core\/.*/, /^\.\.\/platformUtils/],
    output: {
      cleanDir: true,
      minify: true,
      comments: false,
      codeSplitting: false,
      format: 'esm',
      dir: 'dist/homebridge-ui',
    },
    platform: 'node',
  },
  {
    input: 'src/homebridge-ui/ui.ts',
    plugins: [htmlPlugin()],
    output: {
      minify: true,
      comments: false,
      codeSplitting: true,
      format: 'cjs',
      dir: 'dist/homebridge-ui/public',
      sourcemap: true,
    },
    platform: 'browser',
  },
]);
