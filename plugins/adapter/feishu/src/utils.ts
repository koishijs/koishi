import crypto from 'crypto'
import { Adapter, Schema } from 'koishi'

export interface AdapterConfig {
  path?: string
  encryptKey?: string
}

export const AdapterConfig = Schema.intersect([
  Schema.object({
    path: Schema.string().role('url').description('要连接的服务器地址。').default('/feishu'),
    encryptKey: Schema.string().role('secret').description('用于事件订阅或事件安全验证时的解密密钥，需要和飞书后台配置的 Encrypt Key 一致。'),
  }),
  Adapter.WebSocketClient.Config,
])

export class Cipher {
  encryptKey: string
  key: Buffer

  constructor(key: string) {
    this.encryptKey = key
    const hash = crypto.createHash('sha256')
    hash.update(key)
    this.key = hash.digest()
  }

  decrypt(encrypt: string) {
    const encryptBuffer = Buffer.from(encrypt, 'base64')
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, encryptBuffer.slice(0, 16))
    let decrypted = decipher.update(encryptBuffer.slice(16).toString('hex'), 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  calculateSignature(timestamp: string, nonce: string, body: string): string {
    const content = timestamp + nonce + this.encryptKey + body
    const sign = crypto.createHash('sha256').update(content).digest('hex')
    return sign
  }
}
