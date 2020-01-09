import { createHmac } from 'crypto'
import { EventEmitter } from 'events'
import { Meta, App, AppOptions, WsClient } from 'koishi-core'
import { RequestData, showTestLog, fromEntries, BASE_SELF_ID } from './utils'
import { snakeCase, randomInt, camelCase } from 'koishi-utils'
import * as http from 'http'
import * as ws from 'ws'
import getPort from 'get-port'
import axios from 'axios'

export default class TestServer extends EventEmitter {
  appList: App[] = []
  requests: RequestData[] = []
  server: { close: () => void }
  responses: Record<string, [Record<string, any>, number]> = {}

  async close () {
    await Promise.all(this.appList.map(app => app.stop()))
    this.server.close()
  }

  shouldHaveLastRequest (method: string, params: Record<string, any>) {
    expect(this.requests[0]).toMatchObject([method, params])
  }

  setResponse (event: string, data: Record<string, any>, retcode = 0) {
    if (!data) {
      this.responses[event] = null
    } else {
      this.responses[event] = [snakeCase(data), retcode]
    }
  }
}

export async function createHttpServer (token?: string) {
  const cqhttpPort = await getPort({ port: randomInt(16384, 49152) })
  const koishiPort = await getPort({ port: randomInt(16384, 49152) })
  return new HttpServer(cqhttpPort, koishiPort, token)
}

export class HttpServer extends TestServer {
  server: http.Server

  constructor (public cqhttpPort: number, public koishiPort: number, public token?: string) {
    super()
    this.server = http.createServer((req, res) => {
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

  post (meta: Meta, port = this.koishiPort, secret?: string) {
    const data = snakeCase(meta)
    const headers: any = {}
    if (secret) {
      headers['X-Signature'] = 'sha1=' + createHmac('sha1', secret).update(JSON.stringify(data)).digest('hex')
    }
    showTestLog('[post]', data)
    return axios.post(`http://localhost:${port}`, data, { headers })
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

export async function createWsServer (token?: string) {
  const cqhttpPort = await getPort({ port: randomInt(16384, 49152) })
  return new WsServer(cqhttpPort, token)
}

export class WsServer extends TestServer {
  server: ws.Server

  constructor (public cqhttpPort: number, public token?: string) {
    super()
    this.server = new ws.Server({ port: cqhttpPort })
    this.server.on('connection', (socket, req) => {
      if (this.token) {
        const signature = req.headers.authorization
        if (!signature || signature !== `Bearer ${this.token}`) {
          return socket.send('authorization failed', () => socket.close())
        }
      }

      socket.on('message', (raw) => {
        this.emit('message')
        const parsed = JSON.parse(raw.toString())
        const { action, params, echo } = parsed
        this.requests.unshift([action, camelCase(params)] as any)
        const [data, retcode] = this.responses[action] || [{}, 0]
        socket.send(JSON.stringify({ data, retcode, echo }))
      })
    })
  }

  nextTick (): Promise<void> {
    return new Promise(resolve => this.on('message', resolve))
  }

  async post (meta: Meta) {
    const data = snakeCase(meta)
    showTestLog('websocket post:', data)
    this.server.clients.forEach(socket => {
      if (socket.readyState !== ws.OPEN) return
      socket.send(JSON.stringify(data))
    })
    await Promise.all(this.appList.map(app => new Promise((resolve) => {
      (app.server as WsClient).socket.once('message', resolve)
    })))
  }

  createBoundApp (options: AppOptions = {}) {
    const app = new App({
      server: `ws://localhost:${this.cqhttpPort}`,
      selfId: BASE_SELF_ID,
      ...options,
    })
    this.appList.push(app)
    return app
  }
}
