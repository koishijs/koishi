import { build } from 'vite'
import { resolve } from 'path'
import vuePlugin from '@vitejs/plugin-vue'

const root = resolve(__dirname, '../client')

build({
  root,
  base: './',
  build: {
    outDir: '../dist',
    minify: 'esbuild',
    emptyOutDir: true,
  },
  plugins: [vuePlugin()],
  resolve: {
    alias: {
      '~/client': root,
      '~/variables': root + '/index.scss',
    },
  },
})
