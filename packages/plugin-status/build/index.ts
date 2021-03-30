/* eslint-disable quote-props */

import { build } from 'vite'
import { resolve } from 'path'
import { copyFile } from 'fs-extra'
import createPluginVue from '@vitejs/plugin-vue'

const root = resolve(__dirname, '../client')
const pkgRoot = resolve(__dirname, '..')
const pluginVue = createPluginVue()

function findModulePath(id: string) {
  const path = require.resolve(id)
  const keyword = `/node_modules/${id}/`
  return path.slice(0, path.indexOf(keyword)) + keyword.slice(0, -1)
}

;(async () => {
  // build for index.html
  await build({
    root,
    base: './',
    build: {
      outDir: '../dist',
      minify: 'esbuild',
      emptyOutDir: true,
      rollupOptions: {
        external: ['./~/vue', './~/client'],
      },
    },
    plugins: [pluginVue],
    resolve: {
      alias: {
        'vue': './~/vue',
        '~/client': './~/client',
        '~/variables': root + '/index.scss',
      },
    },
  })

  // build for client.js
  await build({
    root,
    build: {
      outDir: '../dist/~',
      minify: 'esbuild',
      lib: {
        formats: ['es'],
        entry: 'index.ts',
        name: 'KoishiClient',
      },
      rollupOptions: {
        external: ['./~/vue', './~/client'],
        output: {
          entryFileNames: 'client.js',
        },
      },
    },
    resolve: {
      alias: {
        'vue': './~/vue',
        '~/client': './~/client',
      },
    },
  })

  await copyFile(findModulePath('vue') + '/dist/vue.runtime.esm-browser.prod.js', pkgRoot + '/dist/~/vue.js')

  // build for koishi-plugin-teach
  build({
    build: {
      minify: 'esbuild',
      emptyOutDir: true,
      assetsDir: '',
      outDir: resolve(__dirname, '../../plugin-teach/dist'),
      rollupOptions: {
        input: resolve(__dirname, '../../plugin-teach/client'),
        external: ['./~/client', './~/vue'],
        output: {
          format: 'es',
          entryFileNames: '[name].js',
        },
      },
    },
    plugins: [pluginVue],
    resolve: {
      alias: {
        'vue': './~/vue',
        'koishi-plugin-status/client': './~/client',
      },
    },
  })
})()
