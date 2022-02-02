import { Dict } from 'koishi'

export namespace Package {
  export interface Base {
    name: string
    version: string
    description: string
  }

  export interface Json extends Base {
    keywords?: string[]
    dependencies?: Dict<string>
    devDependencies?: Dict<string>
    peerDependencies?: Dict<string>
    optionalDependencies?: Dict<string>
  }

  function getDeps(deps: Dict<string> = {}) {
    return Object.keys(deps).filter(name => name.startsWith('@koishijs/plugin-') || name.startsWith('koishi-plugin-'))
  }

  export interface Meta {
    version: string
    devDeps: string[]
    peerDeps: string[]
    keywords: string[]
  }

  export namespace Meta {
    export function from(pkg: Json) {
      const meta = {} as Meta
      meta.version = pkg.version
      meta.keywords = pkg.keywords || []
      meta.devDeps = getDeps(pkg.devDependencies || {})
      meta.peerDeps = getDeps(pkg.peerDependencies || {})
      return meta
    }
  }

  export interface Local extends Json {
    private?: boolean
  }

  export interface Remote extends Json {
    deprecated?: string
    dist: {
      unpackedSize: number
    }
  }

  export interface Registry extends Base {
    versions: Dict<Remote>
    time: {
      created: string
      modified: string
    }
    license: string
    readme: string
    readmeFilename: string
  }

  export interface SearchItem {
    package: Base
    score: {
      final: number
      detail: {
        quality: number
        popularity: number
        maintenance: number
      }
    }
    searchScore: number
  }

  export interface SearchResult {
    total: number
    time: string
    objects: SearchItem[]
  }
}
