import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(root, 'web'),
  publicDir: 'static',
  base: '/assets/',
  build: {
    outDir: path.join(root, 'public', 'assets'),
    emptyOutDir: true,
    manifest: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        main: path.join(root, 'web', 'ts', 'main.ts'),
        calculator: path.join(root, 'web', 'ts', 'calculator.ts'),
        admin: path.join(root, 'web', 'ts', 'admin.ts'),
        print: path.join(root, 'web', 'ts', 'print.ts'),
      },
      output: {
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] ?? 'asset';
          if (name.endsWith('.css')) return 'css/[name]-[hash][extname]';
          if (/\.(woff2?|ttf|otf)$/.test(name)) return 'fonts/[name][extname]';
          if (/\.(png|jpe?g|webp|avif|svg|gif|ico)$/.test(name)) return 'img/[name][extname]';
          return 'misc/[name]-[hash][extname]';
        },
      },
    },
  },
});
