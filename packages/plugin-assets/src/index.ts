import { Assets, Context, Random, sanitize, Time, trimSlash } from 'koishi-core'
import axios, { AxiosRequestConfig } from 'axios'
import { promises as fs, createReadStream, existsSync } from 'fs'
import { extname, resolve } from 'path'
import { createHmac } from 'crypto'
import FormData from 'form-data'

interface ServerConfig {
  path?: string
  root?: string
  selfUrl?: string
  secret?: string
  axiosConfig?: AxiosRequestConfig
}

class AssetServer implements Assets {
  types = ['video', 'audio', 'image'] as const

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
  types = ['video', 'audio', 'image'] as const

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

interface SmmsConfig {
  type: 'smms'
  endpoint?: string
  token: string
  axiosConfig?: AxiosRequestConfig
}

class SmmsAssets implements Assets {
  types = ['image'] as const

  constructor(public ctx: Context, public config: SmmsConfig) {
    config.endpoint = trimSlash(config.endpoint || 'https://sm.ms/api/v2')
  }

  async upload(url: string, file: string) {
    const { token, endpoint, axiosConfig } = this.config
    const { data: filedata } = await axios.get<ArrayBuffer>(url, {
      ...axiosConfig,
      responseType: 'arraybuffer',
    })
    const payload = new FormData()
    payload.append('smfile', filedata, file)
    const { data } = await axios.post(endpoint + '/upload', payload, {
      ...axiosConfig,
      headers: {
        authorization: token,
        ...payload.getHeaders(),
      },
    })
    if (data.code === 'image_repeated') {
      return data.images
    }
    if (!data.data) {
      const error = new Error(data.message)
      return Object.assign(error, data)
    }
    return data.data.url
  }

  async stats() {
    const { token, endpoint, axiosConfig } = this.config
    const { data } = await axios.post(endpoint + '/profile', null, {
      ...axiosConfig,
      headers: {
        authorization: token,
      },
    })
    return {
      assetSize: data.data.disk_usage_raw,
    }
  }
}

export type Config = ServerConfig | ClientConfig | SmmsConfig

export const name = 'assets'

export function apply(ctx: Context, config: Config = {}) {
  config.axiosConfig = {
    timeout: Time.second * 5,
    ...ctx.app.options.axiosConfig,
    ...config.axiosConfig,
  }

  if ('type' in config) {
    if (config.type === 'smms') {
      ctx.assets = new SmmsAssets(ctx, config)
    } else {
      throw new Error(`unsupported asset provider type "${config.type}"`)
    }
  } else if ('server' in config) {
    ctx.assets = new AssetClient(ctx, config)
  } else {
    ctx.assets = new AssetServer(ctx, config)
  }
}
