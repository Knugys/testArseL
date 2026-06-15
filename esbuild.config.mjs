import esbuild from 'esbuild';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await mkdir('dist', { recursive: true });

const common = {
  entryPoints: ['src/plugin.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2020'],
  alias: {
    'pdfkit': path.resolve(__dirname, 'node_modules/pdfkit/js/pdfkit.standalone.js'),
  },
  define: {
    'global': 'globalThis',
    'process.env.NODE_ENV': '"production"',
    'process.browser': 'true',
  },
};

// Ominifierad — för felsökning
await esbuild.build({ ...common, outfile: 'dist/plugin.js', minify: false, sourcemap: false });
console.log('dist/plugin.js skapad');

// Minifierad — för produktion / Bubble hosting
await esbuild.build({ ...common, outfile: 'dist/plugin.min.js', minify: true, sourcemap: false });
console.log('dist/plugin.min.js skapad');
