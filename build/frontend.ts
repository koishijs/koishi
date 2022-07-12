import { buildExtension } from '@koishijs/client/src'
import { cwd, getPackages } from './utils'
import { RollupOutput } from 'rollup'
import { appendFile, copyFile } from 'fs-extra'
import * as vite from 'vite'
import vue from '@vitejs/plugin-vue'
import cac from 'cac'

const { args } = cac().help().parse()

function findModulePath(id: string) {
  const path = require.resolve(id).replace(/\\/g, '/')
  const keyword = `/node_modules/${id}/`
  return path.slice(0, path.indexOf(keyword)) + keyword.slice(0, -1)
}

const dist = cwd + '/plugins/frontend/console/dist'

export async function build(root: string, config: vite.UserConfig = {}) {
  const { rollupOptions = {} } = config.build || {}
  return vite.build({
    root,
    build: {
      outDir: cwd + '/plugins/frontend/console/dist',
      emptyOutDir: true,
      cssCodeSplit: false,
      ...config.build,
      rollupOptions: {
        ...rollupOptions,
        external: [
          root + '/vue.js',
          root + '/vue-router.js',
          root + '/client.js',
          root + '/vueuse.js',
        ],
        output: {
          format: 'module',
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
          ...rollupOptions.output,
        },
      },
    },
    plugins: [vue()],
    resolve: {
      alias: {
        'vue': root + '/vue.js',
        'vue-router': root + '/vue-router.js',
        '@vueuse/core': root + '/vueuse.js',
        '@koishijs/client': root + '/client.js',
      },
    },
  })
}

async function buildConsole() {
  // build for console main
  const { output } = await build(cwd + '/plugins/frontend/client/app') as RollupOutput

  await Promise.all([
    copyFile(findModulePath('vue') + '/dist/vue.runtime.esm-browser.prod.js', dist + '/vue.js'),
    build(findModulePath('vue-router') + '/dist', {
      build: {
        outDir: dist,
        emptyOutDir: false,
        rollupOptions: {
          input: {
            'vue-router': findModulePath('vue-router') + '/dist/vue-router.esm-browser.js',
          },
          preserveEntrySignatures: 'strict',
        },
      },
    }),
    build(findModulePath('@vueuse/core'), {
      build: {
        outDir: dist,
        emptyOutDir: false,
        rollupOptions: {
          input: {
            'vueuse': findModulePath('@vueuse/core') + '/index.mjs',
          },
          preserveEntrySignatures: 'strict',
        },
      },
    }),
  ])

  await build(cwd + '/plugins/frontend/client/client', {
    build: {
      outDir: dist,
      emptyOutDir: false,
      rollupOptions: {
        input: {
          'client': cwd + '/plugins/frontend/client/client/index.ts',
        },
        output: {
          manualChunks: {
            element: ['element-plus'],
          },
        },
        preserveEntrySignatures: 'strict',
      },
    },
  })

  for (const file of output) {
    if (file.type === 'asset' && file.name === 'style.css') {
      await appendFile(dist + '/style.css', file.source)
    }
  }
}

;(async () => {
  const folders = await getPackages(args)

  for (const folder of folders) {
    if (folder === 'plugins/frontend/client') {
      await buildConsole()
      continue
    }

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
})()
