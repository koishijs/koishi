import { defineBuild } from '../../../build'

export = defineBuild(async (base, options) => {
  options.plugins = [{
    name: 'external library',
    setup(build) {
      build.onResolve({ filter: /^([@/\w-]+|.+\/utils)$/ }, (a) => ({ external: true }))
    },
  }]

  options.entryPoints.push(base + '/src/bin.ts')
  options.entryPoints.push(base + '/src/utils.ts')
})
