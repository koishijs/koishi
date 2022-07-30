import { Assets, Context, Quester, Random, Schema } from 'koishi'
import { createHmac } from 'crypto'

class RemoteAssets extends Assets {
  http: Quester

  constructor(ctx: Context, private config: RemoteAssets.Config) {
    super(ctx)
    this.http = ctx.http.extend(config)
  }

  start() {}

  stop() {}

  async upload(url: string, file: string) {
    if (url.startsWith(this.config.endpoint)) return url
    const { secret } = this.config
    const params = { url, file } as any
    if (secret) {
      params.salt = Random.id()
      params.sign = createHmac('sha1', secret).update(file + params.salt).digest('hex')
    }
    const data = await this.http.post('', null, { params })
    return data
  }

  async stats() {
    return this.http.get('')
  }
}

namespace RemoteAssets {
  export interface Config extends Quester.Config {
    endpoint: string
    secret?: string
  }

  export const Config: Schema<Config> = Schema.object({
    endpoint: Schema.string().role('link').description('远程服务器地址。').required(),
    secret: Schema.string().description('服务器设置的密钥，配合 assets-local 使用。').role('secret'),
  })
}

export default RemoteAssets
