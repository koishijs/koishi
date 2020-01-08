import { createHmac } from 'crypto'
import { Meta, App, AppOptions } from 'koishi-core'
import { snakeCase, randomInt, camelCase } from 'koishi-utils'
import { Server, createServer } from 'http'
import { showTestLog, fromEntries, BASE_SELF_ID } from './utils'
import getPort from 'get-port'
import axios from 'axios'

export async function createHttpServer (token?: string) {
  const cqhttpPort = await getPort({ port: randomInt(16384, 49152) })
  const koishiPort = await getPort({ port: randomInt(16384, 49152) })
  return new HttpServer(cqhttpPort, koishiPort, token)
}

export class HttpServer {
  appList: App[] = []
  server: Server
  requests: [string, Record<string, string>][] = []
  responses: Record<string, [Record<string, any>, number]> = {}

  constructor (public cqhttpPort: number, public koishiPort: number, public token?: string) {
    this.server = createServer((req, res) => {
      let body = ''
      req.on('data', chunk => body += chunk)
      req.on('end', () => {
        showTestLog('[http]', req.url)

        if (this.token) {
          // no signature
          const signature = req.headers.authorization
          if (!signature) {
            res.statusCode = 401
            return res.end()
          }

          // invalid signature
          if (signature !== `Token ${this.token}`) {
            res.statusCode = 403
            return res.end()
          }
        }

        res.statusCode = 200
        const url = new URL(req.url, `http://${req.headers.host}`)
        const path = url.pathname.slice(1)
        const params = fromEntries(url.searchParams.entries())
        this.requests.unshift([path, camelCase(params)])
        const [data, retcode] = this.responses[path] || [{}, 0]
        res.write(JSON.stringify({ data, retcode }))
        res.end()
      })
    }).listen(cqhttpPort)
  }

  async close () {
    await Promise.all(this.appList.map(app => app.stop()))
    this.server.close()
  }

  shouldHaveLastRequest (method: string, params: Record<string, string>) {
    expect(this.requests[0]).toMatchObject([method, params])
  }

  post (meta: Meta, port = this.koishiPort, secret?: string) {
    const data = snakeCase(meta)
    const headers: any = {}
    if (secret) {
      headers['X-Signature'] = 'sha1=' + createHmac('sha1', secret).update(JSON.stringify(data)).digest('hex')
    }
    showTestLog('[post]', data)
    return axios.post(`http://localhost:${port}`, data, { headers })
  }

  setResponse (event: string, data: Record<string, any>, retcode = 0) {
    if (!data) {
      this.responses[event] = null
    } else {
      this.responses[event] = [snakeCase(data), retcode]
    }
  }

  createBoundApp (options: AppOptions = {}) {
    const app = new App({
      port: this.koishiPort,
      server: `http://localhost:${this.cqhttpPort}`,
      selfId: BASE_SELF_ID,
      ...options,
    })
    this.appList.push(app)
    return app
  }
}
