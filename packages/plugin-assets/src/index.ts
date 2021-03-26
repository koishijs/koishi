import { Assets, Context, Random, sanitize, trimSlash } from 'koishi-core'
import axios, { AxiosRequestConfig } from 'axios'
import { promises as fs, createReadStream, existsSync } from 'fs'
import { extname, resolve } from 'path'
import { createHmac } from 'crypto'

interface ServerConfig {
  path?: string
  root?: string
  selfUrl?: string
  secret?: string
  axiosConfig?: AxiosRequestConfig
}

class AssetServer implements Assets {
  types: ['video', 'audio', 'image']

  private _promise: Promise<void>
  private _stats: Assets.Stats = {
    assetCount: 0,
    assetSize: 0,
  }

  constructor(public ctx: Context, public config: ServerConfig) {
    const path = sanitize(config.path || '/assets')
    config.root ||= resolve(__dirname, '../public')

    if (config.selfUrl) {
      config.selfUrl = trimSlash(config.selfUrl)
    } else if (!(config.selfUrl = ctx.app.options.selfUrl)) {
      throw new Error(`missing configuration "selfUrl" or "server"`)
    }

    ctx.router.get(path, async (ctx) => {
      return ctx.body = await this.stats()
    })

    ctx.router.get(path + '/:name', (ctx) => {
      const filename = resolve(config.root, ctx.params.name)
      ctx.type = extname(filename)
      return ctx.body = createReadStream(filename)
    })

    ctx.router.post(path, async (ctx) => {
      const { salt, sign, url, file } = ctx.query
      if (Array.isArray(file) || Array.isArray(url)) {
        return ctx.status = 400
      }

      if (config.secret) {
        if (!salt || !sign) return ctx.status = 400
        const hash = createHmac('sha1', config.secret).update(file + salt).digest('hex')
        if (hash !== sign) return ctx.status = 403
      }

      await this.upload(url, file)
      return ctx.status = 200
    })

    this._promise = this.init()
  }

  async init() {
    const root = this.config.root
    await fs.mkdir(root, { recursive: true })
    const filenames = await fs.readdir(root)
    this._stats.assetCount = filenames.length
    await Promise.all(filenames.map(async (file) => {
      const { size } = await fs.stat(resolve(root, file))
      this._stats.assetSize += size
    }))
  }

  async upload(url: string, file: string) {
    await this._promise
    const { selfUrl, path, root, axiosConfig } = this.config
    const filename = resolve(root, file)
    if (!existsSync(filename)) {
      const { data } = await axios.get<ArrayBuffer>(url, {
        ...axiosConfig,
        responseType: 'arraybuffer',
      })
      await fs.writeFile(filename, Buffer.from(data))
      this._stats.assetCount += 1
      this._stats.assetSize += data.byteLength
    }
    return `${selfUrl}${path}/${file}`
  }

  async stats() {
    await this._promise
    return this._stats
  }
}

interface ClientConfig {
  server: string
  secret?: string
  axiosConfig?: AxiosRequestConfig
}

class AssetClient implements Assets {
  types: ['video', 'audio', 'image']

  constructor(public ctx: Context, public config: ClientConfig) {}

  async upload(url: string, file: string) {
    const { server, secret, axiosConfig } = this.config
    const params = { url, file } as any
    if (secret) {
      params.salt = Random.uuid()
      params.sign = createHmac('sha1', secret).update(file + params.salt).digest('hex')
    }
    const { data } = await axios.post(server, { ...axiosConfig, params })
    return data
  }

  async stats() {
    const { data } = await axios.get(this.config.server, this.config.axiosConfig)
    return data
  }
}

export type Config = ServerConfig | ClientConfig

export const name = 'assets'

export function apply(ctx: Context, config: Config = {}) {
  config.axiosConfig = {
    ...ctx.app.options.axiosConfig,
    ...config.axiosConfig,
  }

  ctx.assets = 'server' in config
    ? new AssetClient(ctx, config)
    : new AssetServer(ctx, config)
}
