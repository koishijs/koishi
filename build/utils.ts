import { resolve } from 'path'
import globby from 'globby'
import spawn from 'cross-spawn'
import { readdir } from 'fs-extra'

export const cwd = resolve(__dirname, '..')

export function getWorkspaces() {
  return globby(require('../package.json').workspaces, {
    cwd,
    deep: 0,
    onlyDirectories: true,
    expandDirectories: false,
  })
}

const categories = [
  'packages',
  'plugins',
  'plugins/adapter',
  'plugins/assets',
  'plugins/database',
  'community',
]

export async function getPackages(args: readonly string[]) {
  const folders = (await Promise.all(categories.map(async (seg) => {
    const names = await readdir(`${cwd}/${seg}`).catch<string[]>(() => [])
    return names.map(name => `${seg}/${name}`).filter(name => !name.includes('.') && !categories.includes(name))
  }))).flat()

  return args.length ? args.map((name) => {
    for (const category of categories) {
      const folder = category + '/' + name
      if (folders.includes(folder)) return folder
    }
  }).filter(Boolean) : folders
}

export type DependencyType = 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies'

export interface PackageJson extends Partial<Record<DependencyType, Record<string, string>>> {
  name?: string
  description?: string
  private?: boolean
  version?: string
}

export function spawnSync(args: string[], silent?: boolean) {
  if (!silent) console.log(`$ ${args.join(' ')}`)
  const result = spawn.sync(args[0], [...args.slice(1), '--color'], { cwd, encoding: 'utf8' })
  if (result.status) {
    throw new Error(result.stderr)
  } else {
    if (!silent) console.log(result.stdout)
    return result.stdout.trim()
  }
}

export function spawnAsync(args: string[]) {
  const child = spawn(args[0], args.slice(1), { cwd, stdio: 'inherit' })
  return new Promise<number>((resolve) => {
    child.on('close', resolve)
  })
}
