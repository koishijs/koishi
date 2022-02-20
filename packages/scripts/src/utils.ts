import spawn from 'cross-spawn'
import globby from 'globby'
import ts from 'typescript'

export const cwd = process.cwd()
export const meta: PackageJson = require(cwd + '/package.json')

export function requireSafe(id: string) {
  try {
    return require(id)
  } catch {}
}

export async function getPackages(args: readonly string[]) {
  const folders = await globby(meta.workspaces, {
    cwd,
    deep: 0,
    onlyDirectories: true,
    expandDirectories: false,
  })

  const packages = Object.fromEntries(folders.map((name) => {
    try {
      return [name, require(`${cwd}/${name}/package.json`)] as [string, PackageJson]
    } catch {}
  }).filter(Boolean))

  if (!args.length) return packages
  return Object.fromEntries(args.map((name) => {
    const targets = Object.keys(packages).filter((folder) => {
      const [last] = folder.split('/').reverse()
      return name === last
    })
    if (!targets.length) {
      throw new Error(`cannot find workspace "${name}"`)
    } else if (targets.length > 1) {
      throw new Error(`ambiguous workspace "${name}": ${targets.join(', ')}`)
    }
    return [targets[0], packages[targets[0]]] as const
  }))
}

export type DependencyType = 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies'

export interface PackageJson extends Partial<Record<DependencyType, Record<string, string>>> {
  name: string
  main?: string
  module?: string
  description?: string
  private?: boolean
  version?: string
  workspaces: string[]
}

interface Reference {
  path: string
}

export interface TsConfig {
  files?: string[]
  references?: Reference[]
  compilerOptions?: ts.CompilerOptions
}

export function spawnAsync(args: string[]) {
  const child = spawn(args[0], args.slice(1), { cwd, stdio: 'inherit' })
  return new Promise<number>((resolve) => {
    child.on('close', resolve)
  })
}
