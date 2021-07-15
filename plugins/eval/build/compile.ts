import { defineBuild } from '../../../build'
import { readdir } from 'fs/promises'

export = defineBuild(async (base, options) => {
  options.plugins = [{
    name: 'external library',
    setup(build) {
      build.onResolve({ filter: /^([@/\w-]+|.+\/transfer)$/ }, () => ({ external: true }))
    },
  }]

  const loaders = await readdir(base + '/src/loaders')
  options.entryPoints.push(base + '/src/worker/index.ts')
  options.entryPoints.push(base + '/src/transfer.ts')
  options.entryPoints.push(...loaders.map(name => `${base}/src/loaders/${name}`))
  options.define.BUILTIN_LOADERS = JSON.stringify(loaders.map(name => name.slice(0, -3)))

  return [options, {
    ...options,
    outdir: base + '/lib/worker',
    entryPoints: [base + '/src/worker/internal.ts'],
    banner: { js: '(function (host, exports, GLOBAL) {' },
    footer: { js: '})' },
  }]
})
