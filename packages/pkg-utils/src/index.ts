import { intersects } from 'semver'
import { EventEmitter } from 'events'
import { Dict, pick } from '@koishijs/utils'

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
  keywords?: string[]
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
  keywords?: string[]
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

export interface AnalyzedPackage extends BasePackage, ScoreDetail {
  author: User
  links: Dict<string>
  keywords: string[]
  shortname: string
  official: boolean
  size: number
  license: string
}

export interface Scanner {
  on(event: 'item', callback: (item: AnalyzedPackage) => void): this
  on(event: 'finish', callback: () => void): this
}

export class Scanner extends EventEmitter {
  private tasks: Promise<void>[]
  protected version = '4'

  constructor(private request: <T>(url: string) => Promise<T>) {
    super()
  }

  private async search(offset: number) {
    const result = await this.request<SearchResult>(`/-/v1/search?text=koishi+plugin&size=250&offset=${offset}`)
    this.tasks.push(...result.objects.map(item => this.analyze(item)))
    return result.total
  }

  private async analyze(object: SearchObject) {
    const { name, links } = object.package
    const official = name.startsWith('@koishijs/plugin-')
    const community = name.startsWith('koishi-plugin-')
    if (!official && !community) return

    const registry = await this.request<Registry>(`/${name}`)
    const versions = Object.values(registry.versions).filter((remote) => {
      const { dependencies, peerDependencies, deprecated } = remote
      const declaredVersion = { ...dependencies, ...peerDependencies }['koishi']
      try {
        return !deprecated && declaredVersion && intersects(this.version, declaredVersion)
      } catch {}
    }).reverse()
    if (!versions.length) return

    const latest = registry.versions[versions[0].version]
    const shortname = official ? name.slice(17) : name.slice(14)
    this.emit('item', {
      name,
      links,
      shortname,
      official,
      size: latest.dist.unpackedSize,
      keywords: latest.keywords || [],
      ...pick(latest, ['version', 'description', 'license', 'author']),
      ...object.score.detail,
    })
  }

  async start() {
    this.tasks = []
    const total = await this.search(0)
    for (let offset = 250; offset < total; offset += 250) {
      await this.search(offset)
    }
    await Promise.all(this.tasks)
    this.emit('finish')
  }
}
