import { storage, registry } from '~/client'
import { reactive } from 'vue'
import { satisfies } from 'semver'

interface PackageBase {
  name: string
  version: string
  description: string
}

interface PackageJson {
  dist: {
    unpackedSize: number
  }
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  peerDependencies: Record<string, string>
  optionalDependencies: Record<string, string>
}

export interface PackageMeta extends PackageBase {
  versions: Record<string, PackageJson>
  distSize: number
  score: {
    final: number
    quality: number
    popularity: number
    maintenance: number
  }
}

interface Manager {
  version: string
  timestamp: number
  packages: PackageMeta[]
}

const timeout = 600000, version = '1.2', timestamp = Date.now()
const data: Manager = storage.get('packages') || { version, timestamp: 0, packages: [] }

if (data.version !== version) {
  data.timestamp = 0
  data.packages = []
}

if (KOISHI_CONFIG.devMode || data.timestamp + timeout < timestamp) {
  update()
}

export const manager = reactive(data)

export async function update() {
  const res = await fetch('https://api.npms.io/v2/search?q=koishi-plugin+not:deprecated&size=250', { mode: 'cors' })
  const json = await res.json()
  manager.version = version
  manager.timestamp = Date.now()
  manager.packages = json.results.map((data) => ({
    ...data.package,
    score: {
      final: data.score.final,
      ...data.score.detail,
    },
  })).sort((a, b) => b.score.final - a.score.final)

  await Promise.all(manager.packages.map(async (meta) => {
    const res = await fetch(KOISHI_CONFIG.endpoint + '/registry/' + meta.name, { mode: 'cors' })
    const json: PackageMeta = await res.json()
    const { dependencies = {}, peerDependencies = {} } = json.versions[meta.version]
    const core = { ...dependencies, ...peerDependencies }['koishi-core']
    if (core && satisfies(KOISHI_CONFIG.version, core)) {
      json.distSize = json.versions[meta.version].dist.unpackedSize
      Object.assign(meta, json)
    } else {
      const index = manager.packages.findIndex(pkg => pkg.name === meta.name)
      manager.packages.splice(index, 1)
    }
  }))

  storage.set('packages', manager)
}
