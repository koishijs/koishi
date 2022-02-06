import { buildExtension } from '@koishijs/builder/src'
import { copyFile } from 'fs/promises'
import { cwd, getPackages } from './utils'
import vue from '@vitejs/plugin-vue'
import vite from 'vite'
import cac from 'cac'

const { args } = cac().help().parse()

function findModulePath(id: string) {
  const path = require.resolve(id).replace(/\\/g, '/')
  const keyword = `/node_modules/${id}/`
  return path.slice(0, path.indexOf(keyword)) + keyword.slice(0, -1)
}

export async function build(root: string, config: vite.UserConfig) {
  const { rollupOptions } = config.build || {}
  await vite.build({
    root,
    build: {
      outDir: '../dist',
      minify: 'esbuild',
      emptyOutDir: true,
      ...config.build,
      rollupOptions: {
        ...rollupOptions,
        external: [
          root + '/vue.js',
          root + '/vue-router.js',
          root + '/client.js',
          root + '/components.js',
        ],
        output: rollupOptions?.input ? {
          format: 'module',
          entryFileNames: '[name].js',
          assetFileNames: '[name][extname]',
          ...rollupOptions.output,
        } : undefined,
      },
    },
    plugins: [vue()],
    resolve: {
      alias: {
        'vue': root + '/vue.js',
        'vue-router': root + '/vue-router.js',
        '~/components': root + '/components.js',
        './client': root + '/client.js',
        '../client': root + '/client.js',
      },
    },
  })
}

async function buildConsole(folder: string) {
  const root = cwd + '/' + folder + '/client'
  const dist = cwd + '/' + folder + '/dist'

  // build for console main
  await build(root, { base: './' })

  await copyFile(findModulePath('vue') + '/dist/vue.runtime.esm-browser.prod.js', dist + '/vue.js')

  // build for console client entry
  await build(cwd, {
    build: {
      outDir: dist,
      emptyOutDir: false,
      rollupOptions: {
        input: {
          'client': root + '/client.ts',
          'vue-router': findModulePath('vue-router') + '/dist/vue-router.esm-browser.js',
          'components': cwd + '/plugins/frontend/components/client/index.ts',
        },
        treeshake: false,
        preserveEntrySignatures: 'strict',
      },
    },
  })
}

;(async () => {
  const folders = await getPackages(args)

  for (const folder of folders) {
    if (folder === 'plugins/frontend/console') {
      await buildConsole(folder)
    } else if (folder === 'plugins/frontend/components') {
      continue
    } else {
      await buildExtension(cwd + '/' + folder, {
        plugins: [{
          name: 'fuck-echarts',
          renderChunk(code, chunk) {
            if (chunk.fileName.includes('echarts')) {
              return code.replace(/\bSymbol(?!\.toStringTag)/g, 'FuckSymbol')
            }
          },
        }],
      })
    }
  }
})()
