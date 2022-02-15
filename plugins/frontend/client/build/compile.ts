import { defineBuild } from '../../../../build'

export = defineBuild(async (base, options) => {
  options.entryPoints.push(base + '/src/bin.ts')
})
