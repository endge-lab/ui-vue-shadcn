import path from 'node:path'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'unplugin-dts/vite'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      name: 'vue-shadcn',
      formats: ['es'],
      fileName: () => 'vue-shadcn.js',
    },
    cssCodeSplit: false,
    rollupOptions: {
      external: [
        '@endge/core',
        '@endge/raph',
        '@endge/utils',
        '@lucide/vue',
        '@tanstack/vue-table',
        '@tanstack/vue-virtual',
        'sortablejs',
        'vue',
      ],
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css'))
            return 'vue-shadcn.css'

          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  plugins: [
    vue(),
    dts({
      bundleTypes: false,
      tsconfigPath: path.resolve(__dirname, 'tsconfig.json'),
      include: ['src'],
      exclude: ['vite.config.ts', 'vitest.config.ts'],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
