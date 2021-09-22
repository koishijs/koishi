import { defineBuild } from '../../../build'

export = defineBuild(async (base, { entryPoints }) => {
  entryPoints.push(base + '/src/worker.ts')
})
