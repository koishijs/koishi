import { clone, Context, Dict, Logger } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { PackageJson } from '@koishijs/market'
import { resolve } from 'path'
import { promises as fsp } from 'fs'
import which from 'which-pm-runs'
import spawn from 'cross-spawn'

declare module '@koishijs/plugin-console' {
  interface Events {
    'market/install'(deps: Dict<string>): Promise<number>
    'market/patch'(name: string, version: string): void
  }
}

const logger = new Logger('market')

class Installer extends DataService<Dict<string>> {
  private metaTask: Promise<PackageJson>

  constructor(public ctx: Context) {
    super(ctx, 'dependencies', { authority: 4 })

    ctx.console.addListener('market/install', this.installDep, { authority: 4 })
    ctx.console.addListener('market/patch', this.patchDep, { authority: 4 })
  }

  get cwd() {
    return this.ctx.app.baseDir
  }

  async _loadDeps() {
    const filename = resolve(this.cwd, 'package.json')
    const source = await fsp.readFile(filename, 'utf8')
    const meta: PackageJson = JSON.parse(source)
    meta.dependencies ||= {}
    return meta
  }

  async get() {
    const meta = await (this.metaTask ||= this._loadDeps())
    return meta.dependencies
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
    const meta = clone(await (this.metaTask ||= this._loadDeps()))
    for (const key in deps) {
      if (deps[key]) {
        meta.dependencies[key] = deps[key]
      } else {
        delete meta.dependencies[key]
      }
    }
    meta.dependencies = Object.fromEntries(Object.entries(meta.dependencies).sort((a, b) => a[0].localeCompare(b[0])))
    await fsp.writeFile(filename, JSON.stringify(meta, null, 2))
    return meta
  }

  patchDep = async (name: string, version: string) => {
    const meta = await this.override({ [name]: version })
    this.metaTask = Promise.resolve(meta)
    this.refresh()
  }

  installDep = async (deps: Dict<string>) => {
    const agent = which()?.name || 'npm'
    const meta = await this.override(deps)
    const args: string[] = []
    if (agent === 'yarn') args.push('install')
    const registry = this.ctx.console.market.config.registry
    if (registry) args.push('--registry=' + registry)
    const code = await this.exec(agent, args)
    if (!code) {
      this.metaTask = Promise.resolve(meta)
      this.refresh()
      this.ctx.console.packages.refresh()
    }
    return code
  }
}

export default Installer
