import { defineBuild } from '../../../build'

export = defineBuild(async (base, options) => {
  options.plugins = [{
    name: 'external library',
    setup(build) {
      build.onResolve({ filter: /^([@/\w-]+|.+\/utils)$/ }, (a) => ({ external: true }))
    },
  }]

  options.entryPoints = [
    base + '/src/bin.ts',
    base + '/src/utils.ts',
    base + '/src/worker/index.ts',
  ]
})
