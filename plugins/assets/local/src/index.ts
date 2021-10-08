import { Assets, Context, sanitize, trimSlash, Schema } from 'koishi'
import { promises as fs, createReadStream, existsSync } from 'fs'
import { extname, resolve } from 'path'
import { createHmac, createHash } from 'crypto'

declare module 'koishi' {
  interface Modules {
    'assets-local': typeof import('.')
  }
}

export const schema = Schema.object({
  root: Schema.string('本地存储资源文件的绝对路径。').required(),
  path: Schema.string('静态图片暴露在服务器的路径。').default('/assets'),
  selfUrl: Schema.string('Koishi 服务暴露在公网的地址。缺省时将使用全局配置。'),
  secret: Schema.string('用于验证上传者的密钥，配合 assets-remote 使用。')
})

interface Config {
  path?: string
  root?: string
  selfUrl?: string
  secret?: string
}

class LocalAssets extends Assets {
  private _promise: Promise<void>
  private _stats: Assets.Stats = {
    assetCount: 0,
    assetSize: 0,
  }

  constructor(ctx: Context, public config: Config) {
    super(ctx)

    config.path = sanitize(config.path || '/assets')
    if (config.root) {
      config.root = resolve(ctx.app.options.baseDir, config.root)
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
    const { selfUrl, path, root } = this.config
    if (file) {
      const filename = resolve(root, file)
      if (!existsSync(filename)) {
        const buffer = await this.download(url)
        await this.write(buffer, filename)
      }
    } else {
      const buffer = await this.download(url)
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

export const name = 'assets-local'

export function apply(ctx: Context, config: Config) {
  ctx.assets = new LocalAssets(ctx, config)
}
