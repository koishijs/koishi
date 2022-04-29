import { intersects } from 'semver'
import { Dict, pick } from 'cosmokit'

export interface User {
  name: string
  email: string
  username?: string
}

export interface BasePackage {
  name: string
  version: string
  description: string
}

export interface PackageJson extends BasePackage {
  keywords: string[]
  dependencies?: Dict<string>
  devDependencies?: Dict<string>
  peerDependencies?: Dict<string>
  optionalDependencies?: Dict<string>
}

export interface LocalPackage extends PackageJson {
  private?: boolean
}

export interface RemotePackage extends PackageJson {
  deprecated?: string
  author: User
  maintainers: User[]
  license: string
  dist: {
    shasum: string
    integrity: string
    tarball: string
    fileCount: number
    unpackedSize: number
  }
}

export interface Registry extends BasePackage {
  versions: Dict<RemotePackage>
  time: {
    created: string
    modified: string
  }
  license: string
  readme: string
  readmeFilename: string
}

export interface SearchPackage extends BasePackage {
  date: string
  links: Dict<string>
  author: User
  publisher: User
  maintainers: User[]
  keywords: string[]
}

export interface ScoreDetail {
  quality: number
  popularity: number
  maintenance: number
}

export interface SearchObject {
  package: SearchPackage
  score: {
    final: number
    detail: ScoreDetail
  }
  searchScore: number
}

export interface SearchResult {
  total: number
  time: string
  objects: SearchObject[]
}

export interface AnalyzedPackage extends SearchPackage, ScoreDetail {
  shortname: string
  official: boolean
  size: number
  license: string
  versions: RemotePackage[]
}

export interface ScanConfig {
  version?: string
  request<T>(url: string): Promise<T>
  onItem?(item: AnalyzedPackage): void
}

export default async function scan(config: ScanConfig) {
  const { version, request, onItem } = config
  const tasks: Promise<void>[] = []

  async function search(offset: number) {
    const result = await config.request<SearchResult>(`/-/v1/search?text=koishi+plugin&size=250&offset=${offset}`)
    tasks.push(...result.objects.map(item => analyze(item)))
    return result.total
  }

  async function analyze(object: SearchObject) {
    const { name } = object.package
    const official = name.startsWith('@koishijs/plugin-')
    const community = name.startsWith('koishi-plugin-')
    if (!official && !community) return

    const registry = await request<Registry>(`/${name}`)
    const versions = Object.values(registry.versions).filter((remote) => {
      const { dependencies, peerDependencies, deprecated } = remote
      const declaredVersion = { ...dependencies, ...peerDependencies }['koishi']
      try {
        return !deprecated && declaredVersion && intersects(version, declaredVersion)
      } catch {}
    }).reverse()
    if (!versions.length) return

    const latest = registry.versions[versions[0].version]
    latest.keywords ??= []
    if (latest.keywords.includes('market:hidden')) return

    const shortname = official ? name.slice(17) : name.slice(14)
    onItem({
      name,
      shortname,
      official,
      versions,
      size: latest.dist.unpackedSize,
      ...pick(object.package, ['date', 'links', 'publisher', 'maintainers']),
      ...pick(latest, ['keywords', 'version', 'description', 'license', 'author']),
      ...object.score.detail,
    })
  }

  const total = await search(0)
  for (let offset = 250; offset < total; offset += 250) {
    await search(offset)
  }

  await Promise.all(tasks)
}
