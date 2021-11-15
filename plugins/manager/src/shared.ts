import { Dict } from 'koishi'

export interface PackageBase {
  name: string
  version: string
  description: string
}

export interface PackageJson extends PackageBase {
  keywords?: string[]
  dependencies?: Dict<string>
  devDependencies?: Dict<string>
  peerDependencies?: Dict<string>
  optionalDependencies?: Dict<string>
}

export interface PackageLocal extends PackageJson {
  private?: boolean
}

export interface PackageRemote extends PackageJson {
  deprecated?: string
  dist: {
    unpackedSize: number
  }
}

export interface PackageRegistry extends PackageBase {
  versions: Dict<PackageRemote>
}

export interface PackageResult {
  package: PackageBase
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
  objects: PackageResult[]
}
