import { Adapter, Context, omit, Quester, Schema } from 'koishi'
import { BotConfig, FeishuBot } from './bot'
import { AdapterConfig, Cipher } from './utils'

export class HttpServer extends Adapter<BotConfig, AdapterConfig> {
  static schema: Schema<BotConfig> = Schema.object({
    token: Schema.string().role('secret'),
    endpoint: Schema.string().role('url').description('要连接的 Feishu 服务器地址。').required(),
    ...omit(Quester.Config.dict, ['endpoint']),
  })

  public bots: FeishuBot[]

  private cipher?: Cipher

  constructor(ctx: Context, config: AdapterConfig) {
    super(ctx, config)

    if (this.config.encryptKey) {
      this.cipher = new Cipher(this.config.encryptKey)
    }
  }

  async start() {
    const { encryptKey, path = '/feishu' } = this.config
    this.ctx.router.post(path, (ctx) => {
      // compare signature if encryptKey is set
      // https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-security-verification
      if (encryptKey) {
        const timestamp = firstOrDefault(ctx.headers['X-Lark-Request-Timestamp'])
        const nonce = firstOrDefault(ctx.headers['X-Lark-Request-Nonce'])
        const signature = firstOrDefault(ctx.headers['X-Lark-Signature'])
        const body = ctx.request.rawBody
        const actualSignature = this.cipher.calculateSignature(timestamp, nonce, body)
        if (signature !== actualSignature) return ctx.status = 403
      }

      // respond challenge message
      // https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-subscription-configure-/request-url-configuration-case
      const body = ctx.request.body
      if (
        body?.type === 'url_verification'
        && body?.challenge
        && typeof body.challenge === 'string'
      ) {
        const obj = this.tryDecrypt(body)
        ctx.response.body = { challenge: obj.challenge }
        return
      }

      // dispatch message
      this.dispatchSession(this.tryDecrypt(ctx.request.body))
    })
  }

  async stop() {}

  async dispatchSession(body: any) {}

  private tryDecrypt(body: any) {
    if (this.cipher) {
      return JSON.parse(this.cipher.decrypt(body))
    }

    return body
  }
}

function firstOrDefault(arg: string | string[]): string {
  if (Array.isArray(arg)) {
    return arg[0]
  }
  return arg
}
