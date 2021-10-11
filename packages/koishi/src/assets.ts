import { Context } from '@koishijs/core'
import { segment } from '@koishijs/utils'

const PROTOCOL_BASE64 = 'base64://'

export abstract class Assets {
  protected types: readonly string[] = ['image', 'audio', 'video']

  abstract upload(url: string, file: string): Promise<string>
  abstract stats(): Promise<Assets.Stats>

  constructor(protected ctx: Context) {}

  public transform(content: string) {
    return segment.transformAsync(content, Object.fromEntries(this.types.map((type) => {
      return [type, async (data) => segment(type, { url: await this.upload(data.url, data.file) })]
    })))
  }

  protected async download(this: Assets, url: string) {
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
