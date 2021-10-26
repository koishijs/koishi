import { Context, Service } from '@koishijs/core'
import { Awaitable, segment } from '@koishijs/utils'

const PROTOCOL_BASE64 = 'base64://'

export abstract class Assets<T = any> extends Service<T> {
  static types = ['image', 'audio', 'video']
  protected types: readonly string[] = Assets.types

  start(): Awaitable<void> {}
  stop(): Awaitable<void> {}

  abstract upload(url: string, file: string): Promise<string>
  abstract stats(): Promise<Assets.Stats>

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
}

export namespace Assets {
  export interface Stats {
    assetCount?: number
    assetSize?: number
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
