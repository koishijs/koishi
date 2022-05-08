import { defineBuild } from '../../../build'

export = defineBuild(async (base, options) => {
  options.entryPoints = [
    base + '/src/bin.ts',
    base + '/src/worker/index.ts',
  ]
})
