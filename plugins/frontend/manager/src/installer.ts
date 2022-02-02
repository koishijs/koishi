import { Context, Dict, Logger } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'
import { existsSync, promises as fsp } from 'fs'
import spawn from 'cross-spawn'

declare module '@koishijs/plugin-console' {
  interface Events {
    install(deps: Dict<string>): Promise<number>
  }
}

type Manager = 'yarn' | 'npm' | 'pnpm'

const logger = new Logger('market')

function supports(command: string, args: string[] = []) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.on('exit', (code) => {
      resolve(code ? false : true)
    })
    child.on('error', () => {
      resolve(false)
    })
  })
}

export default class Installer extends DataService {
  private agentTask: Promise<Manager>

  constructor(public ctx: Context) {
    super(ctx, 'installer')

    ctx.console.addListener('install', this.install)
  }

  get cwd() {
    return this.ctx.app.baseDir
  }

  async _getAgent(): Promise<Manager> {
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
    const source = await fsp.readFile(filename, 'utf8')
    const meta = JSON.parse(source)
    for (const key in deps) {
      if (deps[key]) {
        meta.dependencies[key] = deps[key]
      } else {
        delete meta.dependencies[key]
      }
    }
    await fsp.writeFile(filename, JSON.stringify(meta, null, 2))
  }

  install = async (deps: Dict<string>) => {
    const [agent] = await Promise.all([
      this.getAgent(),
      this.override(deps),
    ])
    const args: string[] = agent === 'yarn' ? [] : ['install']
    const code = await this.exec(agent, args)
    if (!code) this.ctx.console.packages.refresh()
    return code
  }
}
