import { Assets, Context, Random, Schema, Requester } from 'koishi'
import { createHmac } from 'crypto'
import { stringify } from 'querystring'

declare module 'koishi' {
  interface Modules {
    'assets-remote': typeof import('.')
  }
}

export const schema = Schema.object({
  endpoint: Schema.string('远程服务器地址。').required(),
  secret: Schema.string('服务器设置的密钥，配合 assets-local 使用。')
})

interface Config extends Requester.Config {
  endpoint: string
  secret?: string
}

class RemoteAssets extends Assets {
  http: Requester

  constructor(ctx: Context, public config: Config) {
    super(ctx)
    this.http = ctx.http.extend(config)
  }

  async upload(url: string, file: string) {
    const { secret } = this.config
    const params = { url, file } as any
    if (secret) {
      params.salt = Random.id()
      params.sign = createHmac('sha1', secret).update(file + params.salt).digest('hex')
    }
    const data = await this.http('POST', '?' + stringify(params))
    return data
  }

  async stats() {
    return this.http.get('')
  }
}

export const name = 'assets-remote'

export function apply(ctx: Context, config: Config) {
  ctx.assets = new RemoteAssets(ctx, config)
}
