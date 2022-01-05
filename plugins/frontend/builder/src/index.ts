/* eslint-disable quote-props */

import * as vite from 'vite'
import pluginVue from '@vitejs/plugin-vue'

export async function build(root: string, config: vite.UserConfig) {
  const { rollupOptions } = config.build || {}
  await vite.build({
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
        ...config.resolve?.alias,
      },
    },
  })
}

export function buildExtension(root: string) {
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
