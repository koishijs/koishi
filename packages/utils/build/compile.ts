import { defineBuild } from '../../../build'
import { resolve } from 'path'

export = defineBuild(async (base, options) => {
  delete options.outdir
  options.outfile = base + '/lib/node.js'

  return [options, {
    ...options,
    minify: true,
    outfile: base + '/lib/browser.js',
    platform: 'browser',
    target: 'esnext',
    format: 'iife',
    globalName: 'Koishi',
    plugins: [{
      name: 'cross-platform logger',
      setup(build) {
        build.onResolve({ filter: /^.+\/logger$/ }, ({ resolveDir }) => ({ path: resolve(resolveDir, 'logger/browser.ts') }))
      },
    }],
  }]
})
