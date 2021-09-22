import { defineBuild } from '../../../build'

export = defineBuild(async (base, options) => {
  delete options.outdir
  options.outfile = base + '/lib/node.js'

  return [options, {
    ...options,
    format: 'esm',
    target: 'esnext',
    platform: 'browser',
    outdir: undefined,
    outfile: base + '/lib/browser.js',
  }]
})
