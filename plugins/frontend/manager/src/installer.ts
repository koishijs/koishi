import { clone, Context, Dict, Logger } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'
import { existsSync, promises as fsp } from 'fs'
import { Package } from './utils'
import spawn from 'cross-spawn'

declare module '@koishijs/plugin-console' {
  interface Events {
    'market/install'(deps: Dict<string>): Promise<number>
    'market/patch'(name: string, version: string): void
  }
}

type Agent = 'yarn' | 'npm' | 'pnpm'

const logger = new Logger('market')

function supports(command: string, args: string[] = []) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.on('exit', (code) => {
      resolve(!code)
    })
    child.on('error', () => {
      resolve(false)
    })
  })
}

class Installer extends DataService<Dict<string>> {
  private agentTask: Promise<Agent>
  private metaTask: Promise<Package.Json>

  constructor(public ctx: Context) {
    super(ctx, 'dependencies')

    ctx.console.addListener('market/install', this.installDep, { authority: 4 })
    ctx.console.addListener('market/patch', this.patchDep, { authority: 4 })
  }

  get cwd() {
    return this.ctx.app.baseDir
  }

  async _getAgent(): Promise<Agent> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { npm_execpath } = process.env
    const isYarn = npm_execpath.includes('yarn')
    if (isYarn) return 'yarn'

    if (existsSync(resolve(this.cwd, 'yarn.lock'))) return 'yarn'
    if (existsSync(resolve(this.cwd, 'pnpm-lock.yaml'))) return 'pnpm'
    if (existsSync(resolve(this.cwd, 'package-lock.json'))) return 'npm'

    const hasPnpm = !isYarn && supports('pnpm', ['--version'])
    return hasPnpm ? 'pnpm' : 'npm'
  }

  getAgent() {
    return this.agentTask ||= this._getAgent()
  }

  async _loadDeps() {
    const filename = resolve(this.cwd, 'package.json')
    const source = await fsp.readFile(filename, 'utf8')
    const meta: Package.Json = JSON.parse(source)
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
    const [agent, meta] = await Promise.all([
      this.getAgent(),
      this.override(deps),
    ])
    const args: string[] = agent === 'yarn' ? [] : ['install']
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
