import { Assets, Context, Random, sanitize, Time, trimSlash, Schema } from 'koishi'
import axios, { AxiosRequestConfig } from 'axios'
import { promises as fs, createReadStream, existsSync } from 'fs'
import { extname, resolve } from 'path'
import { createHmac, createHash } from 'crypto'
import FormData from 'form-data'

declare module 'koishi' {
  interface Module {
    assets: typeof import('.')
  }
}

const PTC_BASE64 = 'base64://'

async function getAssetBuffer(url: string, axiosConfig: AxiosRequestConfig) {
  if (url.startsWith(PTC_BASE64)) {
    return Buffer.from(url.slice(PTC_BASE64.length), 'base64')
  }
  const { data } = await axios.get<ArrayBuffer>(url, {
    ...axiosConfig,
    responseType: 'arraybuffer',
  })
  return Buffer.from(data)
}

export const schema = Schema.select({
  local: Schema.object({
    root: Schema.string('本地存储资源文件的绝对路径。').required(),
    path: Schema.string('静态图片暴露在服务器的路径。').default('/assets'),
    selfUrl: Schema.string('Koishi 服务暴露在公网的地址。缺省时将使用全局配置。'),
    secret: Schema.string('用于验证上传者的密钥，配合 type: remote 使用。')
  }, '存储在本地目录'),

  remote: Schema.object({
    server: Schema.string('远程服务器地址。').required(),
    secret: Schema.string('服务器设置的密钥，配合 type: local 使用。')
  }, '存储在远程服务器'),

  smms: Schema.object({
    token: Schema.string('sm.ms 的访问令牌。').required(),
  }, '存储在 sm.ms 图床服务'),
}, 'type', '使用的存储方式。')

interface LocalConfig {
  type: 'local'
  path?: string
  root?: string
  selfUrl?: string
  secret?: string
  axiosConfig?: AxiosRequestConfig
}

class LocalAssets implements Assets {
  types = ['video', 'audio', 'image'] as const

  private _promise: Promise<void>
  private _stats: Assets.Stats = {
    assetCount: 0,
    assetSize: 0,
  }

  constructor(public ctx: Context, public config: LocalConfig) {
    config.path = sanitize(config.path || '/assets')
    if (config.root) {
      config.root = resolve(process.cwd(), config.root)
    } else {
      config.root = resolve(__dirname, '../public')
    }

    if (config.selfUrl) {
      config.selfUrl = trimSlash(config.selfUrl)
    } else if (!(config.selfUrl = ctx.app.options.selfUrl)) {
      throw new Error(`missing configuration "selfUrl" or "server"`)
    }

    ctx.router.get(config.path, async (ctx) => {
      return ctx.body = await this.stats()
    })

    ctx.router.get(config.path + '/:name', (ctx) => {
      const filename = resolve(config.root, ctx.params.name)
      ctx.type = extname(filename)
      return ctx.body = createReadStream(filename)
    })

    ctx.router.post(config.path, async (ctx) => {
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

  async write(buffer: Buffer, filename: string) {
    await fs.writeFile(filename, buffer)
    this._stats.assetCount += 1
    this._stats.assetSize += buffer.byteLength
  }

  async upload(url: string, file: string) {
    await this._promise
    const { selfUrl, path, root, axiosConfig } = this.config
    if (file) {
      const filename = resolve(root, file)
      if (!existsSync(filename)) {
        const buffer = await getAssetBuffer(url, axiosConfig)
        await this.write(buffer, filename)
      }
    } else {
      const buffer = await getAssetBuffer(url, axiosConfig)
      file = createHash('sha1').update(buffer).digest('hex')
      await this.write(buffer, resolve(root, file))
    }
    return `${selfUrl}${path}/${file}`
  }

  async stats() {
    await this._promise
    return this._stats
  }
}

interface RemoteConfig {
  type: 'remote'
  server: string
  secret?: string
  axiosConfig?: AxiosRequestConfig
}

class RemoteAssets implements Assets {
  types = ['video', 'audio', 'image'] as const

  constructor(public ctx: Context, public config: RemoteConfig) {}

  async upload(url: string, file: string) {
    const { server, secret, axiosConfig } = this.config
    const params = { url, file } as any
    if (secret) {
      params.salt = Random.id()
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
    const buffer = await getAssetBuffer(url, axiosConfig)
    const payload = new FormData()
    payload.append('smfile', buffer, file || createHash('sha1').update(buffer).digest('hex'))
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
      timeout: Time.second * 5,
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

export type Config = LocalConfig | RemoteConfig | SmmsConfig

export const name = 'assets'

export function apply(ctx: Context, config: Config) {
  config.axiosConfig = {
    ...ctx.app.options.axiosConfig,
    ...config.axiosConfig,
  }

  switch (config.type) {
    case 'local': ctx.assets = new LocalAssets(ctx, config); break
    case 'remote': ctx.assets = new RemoteAssets(ctx, config); break
    case 'smms': ctx.assets = new SmmsAssets(ctx, config); break
    default: throw new Error(`unsupported asset provider type "${config['type']}"`)
  }
}
