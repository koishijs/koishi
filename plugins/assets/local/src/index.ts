import { Assets, Context, sanitize, Schema, trimSlash } from 'koishi'
import { createReadStream, promises as fs } from 'fs'
import { basename, resolve } from 'path'
import { createHmac } from 'crypto'
import { stream as fileTypeStream } from 'file-type'

class LocalAssets extends Assets {
  private _promise: Promise<void>
  private _stats: Assets.Stats = {
    assetCount: 0,
    assetSize: 0,
  }

  private path: string
  private root: string
  private selfUrl: string

  constructor(ctx: Context, private config: LocalAssets.Config) {
    super(ctx)

    this.path = sanitize(config.path || '/assets')
    if (config.root) {
      this.root = resolve(ctx.app.baseDir, config.root)
    } else {
      this.root = resolve(__dirname, '../public')
    }

    if (config.selfUrl) {
      this.selfUrl = trimSlash(config.selfUrl)
    } else if (!(this.selfUrl = ctx.root.config.selfUrl)) {
      throw new Error(`missing configuration "selfUrl"`)
    }

    ctx.router.get(this.path, async (ctx) => {
      return ctx.body = await this.stats()
    })

    ctx.router.get(this.path + '/:name', async (ctx) => {
      const filename = resolve(this.root, basename(ctx.params.name))
      const stream = await fileTypeStream(createReadStream(filename))
      ctx.type = stream.fileType?.mime
      return ctx.body = stream
    })

    ctx.router.post(this.path, async (ctx) => {
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

  start() {}

  stop() {}

  async init() {
    await fs.mkdir(this.root, { recursive: true })
    const filenames = await fs.readdir(this.root)
    this._stats.assetCount = filenames.length
    await Promise.all(filenames.map(async (file) => {
      const { size } = await fs.stat(resolve(this.root, file))
      this._stats.assetSize += size
    }))
  }

  async write(buffer: Buffer, filename: string) {
    await fs.writeFile(filename, buffer)
    this._stats.assetCount += 1
    this._stats.assetSize += buffer.byteLength
  }

  async upload(url: string, file: string) {
    if (url.startsWith(this.selfUrl)) return url
    await this._promise
    const { selfUrl, path, root } = this
    const { buffer, filename } = await this.analyze(url, file)
    const savePath = resolve(root, filename)
    await this.write(buffer, savePath)
    return `${selfUrl}${path}/${filename}`
  }

  async stats() {
    await this._promise
    return this._stats
  }
}

namespace LocalAssets {
  export interface Config {
    path?: string
    root?: string
    secret?: string
    selfUrl?: string
  }

  export const Config: Schema<Config> = Schema.object({
    root: Schema.string().description('本地存储资源文件的绝对路径。'),
    path: Schema.string().default('/files').description('静态图片暴露在服务器的路径。'),
    selfUrl: Schema.string().role('link').description('Koishi 服务暴露在公网的地址。缺省时将使用全局配置。'),
    secret: Schema.string().description('用于验证上传者的密钥，配合 assets-remote 使用。').role('secret'),
  })
}

export default LocalAssets
