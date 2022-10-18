import { Context, Schema, segment, Service } from '@koishijs/core'
import { defineProperty } from '@koishijs/utils'
import { createHash } from 'crypto'
import { basename } from 'path'
import FileType from 'file-type'

declare module '@koishijs/core' {
  namespace Context {
    interface Config {
      assets?: Config.Assets
    }

    namespace Config {
      interface Static {
        Assets?: Schema<Assets>
      }

      interface Assets {
        whitelist?: string[]
      }
    }
  }
}

Context.service('assets')

defineProperty(Context.Config, 'Assets', Schema.object({
  whitelist: Schema.array(Schema.string().required().role('link')).description('不处理的白名单 URL 列表。'),
}).description('资源设置'))

export abstract class Assets extends Service {
  static types = ['image', 'audio', 'video']
  protected types: readonly string[] = Assets.types

  abstract upload(url: string, file: string): Promise<string>
  abstract stats(): Promise<Assets.Stats>

  constructor(protected ctx: Context) {
    super(ctx, 'assets')
  }

  public async transform(content: string) {
    return await segment.transformAsync(content, Object.fromEntries(this.types.map((type) => {
      return [type, async (data) => {
        if (this.ctx.root.config.assets.whitelist.some(prefix => data.url.startsWith(prefix))) {
          return segment(type, data)
        } else {
          return segment(type, { url: await this.upload(data.url, data.file) })
        }
      }]
    })))
  }

  protected async analyze(url: string, name = ''): Promise<Assets.FileInfo> {
    const file = await this.ctx.http.file(url)
    const buffer = Buffer.from(file.data)
    const hash = createHash('sha1').update(buffer).digest('hex')
    if (name) {
      name = basename(name)
      if (!name.startsWith('.')) {
        name = `-${name}`
      }
    } else {
      const fileType = await FileType.fromBuffer(buffer)
      if (fileType) {
        name = `.${fileType.ext}`
      }
    }
    return { buffer, hash, name, filename: `${hash}${name}` }
  }
}

export namespace Assets {
  export interface Stats {
    assetCount?: number
    assetSize?: number
  }

  export interface FileInfo {
    buffer: Buffer
    hash: string
    name: string
    filename: string
  }
}
