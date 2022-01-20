import { build, buildExtension } from '.'
import { copyFile } from 'fs/promises'
import { resolve } from 'path'

function findModulePath(id: string) {
  const path = require.resolve(id).replace(/\\/g, '/')
  const keyword = `/node_modules/${id}/`
  return path.slice(0, path.indexOf(keyword)) + keyword.slice(0, -1)
}

;(async () => {
  const root = resolve(__dirname, '../../console/client')
  const dist = resolve(__dirname, '../../console/dist')

  // build for console main
  await build(root, {
    base: './',
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

  // build for console client entry
  await build(resolve(__dirname, '../../../..'), {
    build: {
      outDir: dist,
      emptyOutDir: false,
      rollupOptions: {
        input: {
          'client': root + '/client.ts',
          'vue-router': findModulePath('vue-router') + '/dist/vue-router.esm-browser.js',
        },
        treeshake: false,
        preserveEntrySignatures: 'strict',
      },
    },
  })

  // build for extensions
  await buildExtension(resolve(__dirname, '../../chat'))
  await buildExtension(resolve(__dirname, '../../commands'))
  await buildExtension(resolve(__dirname, '../../logs'))
  await buildExtension(resolve(__dirname, '../../manager'))
  await buildExtension(resolve(__dirname, '../../status'))
  await buildExtension(resolve(__dirname, '../../../teach'))
})()
