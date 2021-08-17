import { defineBuild } from '../../../build'

export = defineBuild(async (base, options) => {
  options.outdir = base + '/lib/node'
  options.entryPoints[0] = base + '/src/node/index.ts'

  return [options, {
    ...options,
    outdir: base + '/lib/cli',
    entryPoints: [
      base + '/src/cli/index.ts',
      base + '/src/cli/worker.ts',
    ],
    plugins: [...options.plugins, {
      name: 'external library',
      setup(build) {
        build.onResolve({ filter: /^\.\.\/node$/ }, () => ({ external: true }))
      },
    }],
  }]
})
