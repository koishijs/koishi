import FormData from 'form-data'
import { Logger, Quester } from 'koishi'

export interface Internal {}

const logger = new Logger('telegram')

export class Internal {
  constructor(public http: Quester) {}

  static define(method: string) {
    Internal.prototype[method] = async function (this: Internal, data = {}) {
      logger.debug('[request] %s %o', method, data)
      const payload = new FormData()
      for (const key in data) {
        payload.append(key, data[key])
      }
      const response = await this.http.post('/' + method, payload, {
        headers: payload.getHeaders(),
      })
      logger.debug('[response] %o', response)
      const { ok, result } = response
      if (ok) return result
      throw new Error('Telegram API error: ' + response)
    }
  }
}
