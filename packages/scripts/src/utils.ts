import spawn from 'cross-spawn'
import globby from 'globby'
import ts from 'typescript'
import ora from 'ora'
import prompts from 'prompts'
import { SpawnOptions } from 'child_process'

export const cwd = process.cwd()
export const meta: PackageJson = require(cwd + '/package.json')

export interface Config {
  mode?: 'monorepo' | 'separate' | 'submodule'
  concurrency?: number
}

export const config: Config = {
  mode: 'monorepo',
  concurrency: 10,
  ...meta['koishi-scripts'],
}

export function requireSafe(id: string) {
  try {
    return require(id)
  } catch {}
}

export async function confirm(message: string) {
  const { value } = await prompts({
    name: 'value',
    type: 'confirm',
    message,
  })
  return value
}

export function exit(message: string) {
  const spinner = ora()
  spinner.info(message)
  return process.exit(0)
}

interface FallbackOptions {
  workspaces?: Record<string, PackageJson>
}

async function getWorkspaces() {
  const folders = await globby(meta.workspaces, {
    cwd,
    deep: 0,
    onlyDirectories: true,
    expandDirectories: false,
  })
  folders.unshift('')

  return Object.fromEntries(folders.map((path) => {
    path = '/' + path
    try {
      return [path, require(`${cwd}${path}/package.json`)] as [string, PackageJson]
    } catch {}
  }).filter(Boolean))
}

export async function getPackages(args: readonly string[], options: FallbackOptions = {}) {
  const workspaces = options.workspaces || await getWorkspaces()
  if (!args.length) return workspaces

  const privates: string[] = []
  const result = Object.fromEntries(args.map((name) => {
    const targets = Object.keys(workspaces).filter((folder) => {
      const [last] = folder.split('/').reverse()
      return name === last
    })
    if (!targets.length) {
      throw new Error(`cannot find workspace "${name}"`)
    } else if (targets.length > 1) {
      throw new Error(`ambiguous workspace "${name}": ${targets.join(', ')}`)
    }
    const path = targets[0]
    const meta = workspaces[path]
    if (meta.private) privates.push(path)
    return [path, meta] as const
  }))

  return result
}

export type DependencyType = 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies'

export interface PackageJson extends Partial<Record<DependencyType, Record<string, string>>> {
  $dirty?: boolean
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
  extends?: string
  files?: string[]
  references?: Reference[]
  compilerOptions?: ts.CompilerOptions
}

export function spawnAsync(args: string[], options: SpawnOptions = {}) {
  const child = spawn(args[0], args.slice(1), { cwd, stdio: 'inherit', ...options })
  return new Promise<number>((resolve) => {
    child.stderr?.pipe(process.stderr)
    child.stdout?.pipe(process.stdout)
    child.on('close', resolve)
  })
}
