import { Context, pick, Dict, version as currentVersion, Schema, App } from 'koishi'
import { dirname, resolve } from 'path'
import { existsSync, promises as fs } from 'fs'
import { spawn, StdioOptions } from 'child_process'
import { satisfies } from 'semver'
import { StatusServer } from '../server'
import { throttle } from 'throttle-debounce'
import axios from 'axios'

interface PackageBase {
  name: string
  version: string
  description: string
}

interface PackageJson extends PackageBase {
  dependencies?: Dict<string>
  devDependencies?: Dict<string>
  peerDependencies?: Dict<string>
  optionalDependencies?: Dict<string>
}

interface PackageLocal extends PackageJson {
  private?: boolean
}

interface PackageRemote extends PackageJson {
  dist: {
    unpackedSize: number
  }
}

interface SearchResult {
  results: any[]
}

interface Registry extends PackageBase {
  versions: Dict<PackageRemote>
}

type Manager = 'yarn' | 'npm'

const cwd = process.cwd()

function execute(bin: string, args: string[] = [], stdio: StdioOptions = 'inherit') {
  // fix for #205
  // https://stackoverflow.com/questions/43230346/error-spawn-npm-enoent
  const child = spawn(bin + (process.platform === 'win32' ? '.cmd' : ''), args, { stdio })
  return new Promise<number>((resolve) => {
    child.on('close', resolve)
  })
}

let _managerPromise: Promise<Manager>
async function getManager(): Promise<Manager> {
  if (existsSync(resolve(cwd, 'yarn.lock'))) return 'yarn'
  if (existsSync(resolve(cwd, 'package-lock.json'))) return 'npm'
  if (!await execute('yarn', ['--version'], 'ignore')) return 'yarn'
  return 'npm'
}

const installArgs: Record<Manager, string[]> = {
  yarn: ['add'],
  npm: ['install', '--loglevel', 'error'],
}

class Market implements StatusServer.DataSource {
  dataCache: Dict<Market.Data> = {}
  localCache: Dict<Promise<Market.Local>> = {}
  callbacks: ((data: Market.Data[]) => void)[] = []
  flushData: throttle<() => void>

  constructor(private ctx: Context, public config: Market.Config) {
    ctx.on('connect', () => {
      this.start()
      this.flushData = throttle(100, () => this.broadcast())

      ctx.on('plugin-added', async (plugin) => {
        const entry = Object.entries(require.cache).find(([, { exports }]) => exports === plugin)
        if (!entry) return
        const state = this.ctx.app.registry.get(plugin)
        const local = await this.localCache[entry[0]]
        local.id = state.id
        this.broadcast()
      })

      ctx.on('plugin-removed', async (plugin) => {
        const entry = Object.entries(require.cache).find(([, { exports }]) => exports === plugin)
        if (!entry) return
        const local = await this.localCache[entry[0]]
        delete local.id
        this.broadcast()
      })
    })
  }

  private async loadPackage(path: string, id?: string): Promise<Market.Local> {
    const data: PackageLocal = JSON.parse(await fs.readFile(path + '/package.json', 'utf8'))
    if (data.private) return null
    const workspace = !path.includes('node_modules')
    const { schema, delegates } = require(path)

    const optional: string[] = []
    const { devDependencies, peerDependencies } = data
    for (const name in { ...devDependencies, ...peerDependencies }) {
      if (name.startsWith('@koishijs/plugin-') || name.startsWith('koishi-plugin-')) optional.push(name)
    }

    return { schema, delegates, workspace, optional, id, ...pick(data, ['name', 'version', 'description']) }
  }

  private async loadCached(filename: string, id?: string) {
    do {
      filename = dirname(filename)
      const files = await fs.readdir(filename)
      if (files.includes('package.json')) break
    } while (true)
    return this.loadPackage(filename, id)
  }

  private async loadLocal(name: string) {
    try {
      const filename = require.resolve(name)
      const path = require.resolve(name + '/package.json').slice(0, -12)
      return this.localCache[filename] ||= this.loadPackage(path)
    } catch {}
  }

  broadcast() {
    this.ctx.webui.broadcast('market', Object.values(this.dataCache))
  }

  async start() {
    const [{ data }] = await Promise.all([
      axios.get<SearchResult>('https://api.npms.io/v2/search?q=koishi+plugin+not:deprecated&size=250'),
      Promise.all(Object.keys(require.cache).map(async (filename) => {
        const { exports } = require.cache[filename]
        const state = this.ctx.app.registry.get(exports)
        if (!state) return
        return this.localCache[filename] = this.loadCached(filename, state.id)
      })),
    ])

    data.results.forEach(async (item) => {
      const { name, version } = item.package
      const official = name.startsWith('@koishijs/plugin-')
      const community = name.startsWith('koishi-plugin-')
      if (!official && !community) return

      const [local, { data }] = await Promise.all([
        this.loadLocal(name),
        axios.get<Registry>(`https://registry.npmjs.org/${name}`),
      ])
      const { dependencies, peerDependencies, dist } = data.versions[version]
      const declaredVersion = { ...dependencies, ...peerDependencies }['koishi']
      if (!declaredVersion || !satisfies(currentVersion, declaredVersion)) return

      const shortname = official ? name.slice(17) : name.slice(14)
      this.dataCache[name] = {
        ...item.package,
        shortname,
        local,
        official,
        size: dist.unpackedSize,
        score: {
          final: item.score.final,
          ...item.score.detail,
        },
      }
      this.flushData()
    })
  }

  async get(forced = false) {
    return Object.values(this.dataCache)
  }

  async install(name: string) {
    const kind = await (_managerPromise ||= getManager())
    const args = [...installArgs[kind], name]
    await execute(kind, args)
    this.ctx.webui.broadcast('market', await this.get(true))
  }
}

namespace Market {
  export interface Config {
    apiPath?: string
  }

  export interface Local extends PackageBase {
    id?: string
    schema?: Schema
    delegates?: Context.Delegates.Meta
    optional: string[]
    workspace: boolean
  }

  export interface Data extends PackageBase {
    shortname: string
    local?: Local
    official: boolean
    size: number
    score: {
      final: number
      quality: number
      popularity: number
      maintenance: number
    }
  }
}

export default Market
