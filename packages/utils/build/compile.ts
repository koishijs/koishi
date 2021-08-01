import { defineBuild } from '../../../build'
import { resolve } from 'path'
import { Plugin } from 'esbuild'

const createLoggerPlugin = (platform: 'node' | 'browser'): Plugin => ({
  name: 'logger',
  setup(build) {
    build.onResolve({ filter: /^.+\/logger$/ }, ({ resolveDir }) => {
      return { path: resolve(resolveDir, `logger/${platform}.ts`) }
    })
  },
})

export = defineBuild(async (base, options) => {
  delete options.outdir

  return [{
    ...options,
    outfile: base + '/lib/node.js',
    plugins: [
      ...options.plugins,
      createLoggerPlugin('node'),
    ],
  }, {
    ...options,
    format: 'esm',
    target: 'esnext',
    platform: 'browser',
    outfile: base + '/lib/browser.js',
    plugins: [
      ...options.plugins,
      createLoggerPlugin('browser'),
    ],
  }]
})
