import { Context, Service } from '@koishijs/core'
import { segment } from '@koishijs/utils'
import { createHash } from 'crypto'
import { fileTypeFromBuffer } from 'file-type'
import { basename } from 'path'

const PROTOCOL_BASE64 = 'base64://'

export abstract class Assets extends Service {
  static types = ['image', 'audio', 'video']
  protected types: readonly string[] = Assets.types

  abstract upload(url: string, file: string): Promise<string>
  abstract stats(): Promise<Assets.Stats>

  constructor(ctx: Context) {
    super(ctx, 'assets')
  }

  public transform(content: string) {
    return segment.transformAsync(content, Object.fromEntries(this.types.map((type) => {
      return [type, async (data) => segment(type, { url: await this.upload(data.url, data.file) })]
    })))
  }

  protected async download(url: string) {
    if (url.startsWith(PROTOCOL_BASE64)) {
      return Buffer.from(url.slice(PROTOCOL_BASE64.length), 'base64')
    }
    const data = await this.ctx.http.get.arraybuffer(url)
    return Buffer.from(data)
  }

  protected async analyze(url: string, file?: string): Promise<Assets.AnalyzeResult> {
    const buffer = await this.download(url)
    const hash = createHash('sha1').update(buffer).digest('hex')
    let filename: string
    if (file) {
      let fileBasename = basename(file)
      if (fileBasename.length > 1 && fileBasename.startsWith('.')) {
        fileBasename = fileBasename.slice(1)
      }
      filename = `${hash}-${fileBasename}`
    } else {
      const fileType = await fileTypeFromBuffer(buffer)
      if (fileType) {
        filename = `${hash}.${fileType.ext}`
      } else {
        filename = hash
      }
    }
    return { buffer, hash, filename }
  }
}

export namespace Assets {
  export interface Stats {
    assetCount?: number
    assetSize?: number
  }

  export interface AnalyzeResult {
    buffer: Buffer
    hash: string
    filename: string
  }
}

const { broadcast } = Context.prototype
Context.prototype.broadcast = async function (this: Context, ...args: any[]) {
  const index = Array.isArray(args[0]) ? 1 : 0
  args[index] = await segment.transformAsync(args[index], Object.fromEntries(Assets.types.map((type) => {
    return [type, async (data) => {
      const buffer = await this.http.get.arraybuffer(data.url)
      return segment(type, { url: 'base64://' + Buffer.from(buffer).toString('base64') })
    }]
  })))
  return broadcast.apply(this, args)
}
