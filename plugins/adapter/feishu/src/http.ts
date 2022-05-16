import { Adapter, Context, Logger } from 'koishi'
import { BotConfig, FeishuBot } from './bot'
import { Event } from './types'
import { AdapterConfig, Cipher } from './utils'

const logger = new Logger('feishu')

export class HttpServer extends Adapter<BotConfig, AdapterConfig> {
  static schema = BotConfig
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
      logger.debug('receive %o', ctx.request.body)

      // compare signature if encryptKey is set
      // But not every message contains signature
      // https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-security-verification
      const signature = firstOrDefault(ctx.headers['X-Lark-Signature'])
      if (encryptKey && signature) {
        const timestamp = firstOrDefault(ctx.headers['X-Lark-Request-Timestamp'])
        const nonce = firstOrDefault(ctx.headers['X-Lark-Request-Nonce'])
        const body = ctx.request.rawBody
        const actualSignature = this.cipher.calculateSignature(timestamp, nonce, body)
        if (signature !== actualSignature) return (ctx.status = 403)
      }

      // try to decrypt message first if encryptKey is set
      const body = this.tryDecryptBody(ctx.request.body)
      // respond challenge message
      // https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-subscription-configure-/request-url-configuration-case
      if (body?.type === 'url_verification' && body?.challenge && typeof body.challenge === 'string') {
        ctx.response.body = { challenge: body.challenge }
        return
      }

      // Feishu requires 200 OK response to make sure event is received
      ctx.body = 'OK'
      ctx.status = 200

      // dispatch message
      this.dispatchSession(this.tryDecryptBody(ctx.request.body))
    })
  }

  async stop() {}

  async dispatchSession(body: Event): Promise<void> {
    const { header } = body
    const { event_type } = header
    switch (event_type) {
      case 'im.message.receive_v1':
        // https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive
        console.log('received message: %o', body)
        break

      default:
        break
    }
  }

  private tryDecryptBody(body: any): any {
    // try to decrypt message if encryptKey is set
    // https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-subscription-configure-/encrypt-key-encryption-configuration-case
    if (this.cipher && typeof body.encrypt === 'string') {
      return JSON.parse(this.cipher.decrypt(body.encrypt))
    }

    if (typeof body.encrypt === 'string' && !this.config.encryptKey) {
      logger.warn('encryptKey is not set, but received encrypted message: %o', body)
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
