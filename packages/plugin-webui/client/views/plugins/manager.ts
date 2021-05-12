import { storage, registry } from '~/client'
import { reactive } from 'vue'
import { satisfies } from 'semver'

interface PackageBase {
  name: string
  version: string
  description: string
}

interface PackageJson {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  peerDependencies: Record<string, string>
  optionalDependencies: Record<string, string>
}

export interface PackageMeta extends PackageBase {
  versions: Record<string, PackageJson>
  'dist-tags': Record<string, string>
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
  const res = await fetch('https://api.npms.io/v2/search?q=koishi-plugin&size=250', { mode: 'cors' })
  const json = await res.json()
  data.version = version
  data.timestamp = Date.now()
  data.packages = json.results.map((data) => ({
    ...data.package,
    score: {
      final: data.score.final,
      ...data.score.detail,
    },
  })).sort((a, b) => b.score.final - a.score.final)

  await Promise.all(json.results.map(async ({ package: meta }) => {
    const res = await fetch(KOISHI_CONFIG.endpoint + '/registry/' + meta.name, { mode: 'cors' })
    const json: PackageMeta = await res.json()
    const { dependencies = {}, peerDependencies = {} } = json.versions[meta.version]
    const core = { ...dependencies, ...peerDependencies }['koishi-core']
    if (core && satisfies(registry.value.version, core)) {
      Object.assign(meta, json)
    } else {
      const index = data.packages.findIndex(pkg => pkg.name === meta.name)
      data.packages.splice(index, 1)
    }
  }))

  storage.set('packages', data)
}
