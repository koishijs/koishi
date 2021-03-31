/* eslint-disable quote-props */

import * as vite from 'vite'
import { resolve } from 'path'
import { copyFile } from 'fs-extra'
import createPluginVue from '@vitejs/plugin-vue'

const root = resolve(__dirname, '../client')
const dist = resolve(__dirname, '../dist')
const pluginVue = createPluginVue()

function findModulePath(id: string) {
  const path = require.resolve(id)
  const keyword = `/node_modules/${id}/`
  return path.slice(0, path.indexOf(keyword)) + keyword.slice(0, -1)
}

function build(root: string, config: vite.UserConfig) {
  const { rollupOptions } = config.build || {}
  return vite.build({
    ...config,
    root,
    build: {
      outDir: '../dist',
      minify: 'esbuild',
      emptyOutDir: true,
      ...config.build,
      rollupOptions: {
        ...rollupOptions,
        external: [root + '/vue.js', root + '/vue-router.js', root + '/client.js'],
        output: rollupOptions?.input ? {
          format: 'module',
          entryFileNames: '[name].js',
          ...rollupOptions.output,
        } : undefined,
      },
    },
    plugins: [pluginVue],
    resolve: {
      alias: {
        'vue': root + '/vue.js',
        'vue-router': root + '/vue-router.js',
        '~/client': root + '/client.js',
        ...config.resolve?.alias,
      },
    },
  })
}

;(async () => {
  // build for index.html
  await build(root, {
    base: './',
    resolve: {
      alias: {
        '~/variables': root + '/index.scss',
      },
    },
  })

  await copyFile(findModulePath('vue') + '/dist/vue.runtime.esm-browser.prod.js', dist + '/vue.js')

  // build for client.js, vue-router.js
  await build(resolve(__dirname, '../../..'), {
    build: {
      outDir: dist,
      emptyOutDir: false,
      rollupOptions: {
        input: {
          'client': root + '/index.ts',
          'vue-router': findModulePath('vue-router') + '/dist/vue-router.esm-browser.js',
        },
        treeshake: false,
        preserveEntrySignatures: 'strict',
      },
    },
  })

  // build for koishi-plugin-chat
  const chat = resolve(__dirname, '../../plugin-chat/client')
  await build(chat, {
    build: {
      assetsDir: '',
      rollupOptions: {
        input: chat + '/index.ts',
      },
    },
  })

  // build for koishi-plugin-teach
  const teach = resolve(__dirname, '../../plugin-teach/client')
  await build(teach, {
    build: {
      assetsDir: '',
      rollupOptions: {
        input: teach + '/index.ts',
      },
    },
  })
})()
