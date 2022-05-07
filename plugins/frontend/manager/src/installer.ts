import { Context, Dict, Logger } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { PackageJson } from '@koishijs/market'
import { resolve } from 'path'
import { promises as fsp, readFileSync } from 'fs'
import which from 'which-pm-runs'
import spawn from 'cross-spawn'

declare module '@koishijs/plugin-console' {
  interface Events {
    'market/install'(deps: Dict<string>): Promise<number>
    'market/patch'(name: string, version: string): void
  }
}

const logger = new Logger('market')

export interface Dependency {
  request: string
  resolved: string
  workspace?: boolean
  versions?: Partial<PackageJson>[]
}

function loadJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

class Installer extends DataService<Dict<Dependency>> {
  private meta: PackageJson

  constructor(public ctx: Context) {
    super(ctx, 'dependencies', { authority: 4 })
    this.meta = loadJson(resolve(this.cwd, 'package.json'))
    this.meta.dependencies ||= {}

    ctx.console.addListener('market/install', this.installDep, { authority: 4 })
    ctx.console.addListener('market/patch', this.patchDep, { authority: 4 })
  }

  get cwd() {
    return this.ctx.app.baseDir
  }

  async get() {
    const results: Dict<Dependency> = {}
    for (const name in this.meta.dependencies) {
      const path = require.resolve(name + '/package.json')
      results[name] = {
        request: this.meta.dependencies[name],
        resolved: loadJson(path).version,
        workspace: !path.includes('node_modules'),
      }
    }
    return results
  }

  async exec(command: string, args: string[]) {
    return new Promise<number>((resolve) => {
      const child = spawn(command, args, { cwd: this.cwd })
      child.on('exit', (code) => resolve(code))
      child.on('error', () => resolve(-1))
      child.stderr.on('data', (data) => {
        data = data.toString().trim()
        if (!data) return
        for (const line of data.split('\n')) {
          logger.warn(line)
        }
      })
      child.stdout.on('data', (data) => {
        data = data.toString().trim()
        if (!data) return
        for (const line of data.split('\n')) {
          logger.info(line)
        }
      })
    })
  }

  async override(deps: Dict<string>) {
    const filename = resolve(this.cwd, 'package.json')
    for (const key in deps) {
      if (deps[key]) {
        this.meta.dependencies[key] = deps[key]
      } else {
        delete this.meta.dependencies[key]
      }
    }
    this.meta.dependencies = Object.fromEntries(Object.entries(this.meta.dependencies).sort((a, b) => a[0].localeCompare(b[0])))
    await fsp.writeFile(filename, JSON.stringify(this.meta, null, 2))
  }

  patchDep = async (name: string, version: string) => {
    await this.override({ [name]: version })
    this.refresh()
  }

  installDep = async (deps: Dict<string>) => {
    const agent = which()?.name || 'npm'
    await this.override(deps)
    const args: string[] = []
    if (agent !== 'yarn') args.push('install')
    const registry = this.ctx.console.market.config.registry
    if (registry) args.push('--registry=' + registry)
    const code = await this.exec(agent, args)
    if (!code) {
      this.refresh()
      this.ctx.console.packages.refresh()
    }
    return code
  }
}

export default Installer
