/* eslint-disable quote-props */

import * as vite from 'vite'
import { resolve } from 'path'
import { copyFile } from 'fs-extra'
import pluginVue from '@vitejs/plugin-vue'

const root = resolve(__dirname, '../client')
const dist = resolve(__dirname, '../dist')

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
          globals: {
            [root + '/vue.js']: 'Vue',
            [root + '/vue-router.js']: 'VueRouter',
            [root + '/client.js']: 'KoishiClient',
          },
          ...rollupOptions.output,
        } : undefined,
      },
    },
    plugins: [pluginVue(), ...config.plugins || []],
    resolve: {
      alias: {
        'vue': root + '/vue.js',
        'vue-router': root + '/vue-router.js',
        '~/client': root + '/client.js',
        'koishi-plugin-webui/client': root + '/client.js',
        ...config.resolve?.alias,
      },
    },
  })
}

function buildExtension(name: string) {
  const root = resolve(__dirname, '../../plugin-' + name)
  return build(root, {
    build: {
      outDir: 'dist',
      assetsDir: '',
      minify: 'esbuild',
      rollupOptions: {
        input: root + '/client/index.ts',
        output: {
          format: 'iife',
        },
      },
    },
  })
}

;(async () => {
  await build(root, {
    base: './',
    resolve: {
      alias: {
        '~/variables': root + '/index.scss',
      },
    },
    plugins: [{
      // magic, don't touch
      name: 'fuck-echarts',
      renderChunk(code, chunk) {
        if (chunk.fileName.includes('echarts')) {
          return code.replace(/\bSymbol(?!\.toStringTag)/g, 'FuckSymbol')
        }
      },
    }],
  })

  await copyFile(findModulePath('vue') + '/dist/vue.runtime.esm-browser.prod.js', dist + '/vue.js')

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

  await buildExtension('chat')
  await buildExtension('teach')
})()
