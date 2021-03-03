import { createHmac } from 'crypto'
import { EventEmitter } from 'events'
import { Session as Meta, App, AppOptions, Server } from 'koishi-core'
import { BASE_SELF_ID, MockedServer } from 'koishi-test-utils'
import { snakeCase, Random, Logger } from 'koishi-utils'
import * as http from 'http'
import * as ws from 'ws'
import getPort from 'get-port'
import axios from 'axios'

export const showTestLog = new Logger('test').debug

export async function createHttpServer(token?: string) {
  const cqhttpPort = await getPort({ port: Random.int(16384, 49152) })
  const koishiPort = await getPort({ port: Random.int(16384, 49152) })
  return new HttpServer(cqhttpPort, koishiPort, token)
}

export class HttpServer extends MockedServer {
  server: http.Server
  appList: App[] = []

  constructor(public cqhttpPort: number, public koishiPort: number, public token?: string) {
    super()
    this.open()
  }

  open() {
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
        const params = Object.fromEntries(url.searchParams.entries())
        res.write(JSON.stringify(this.receive(path, params)))
        res.end()
      })
    }).listen(this.cqhttpPort)
  }

  post(meta: Meta, port = this.koishiPort, secret?: string) {
    const data = snakeCase(meta)
    const headers: any = {}
    if (secret) {
      headers['X-Signature'] = 'sha1=' + createHmac('sha1', secret).update(JSON.stringify(data)).digest('hex')
    }
    showTestLog('[post]', data)
    return axios.post(`http://localhost:${port}`, data, { headers })
  }

  createBoundApp(options: AppOptions = {}) {
    const app = new App({
      port: this.koishiPort,
      server: `http://localhost:${this.cqhttpPort}`,
      selfId: BASE_SELF_ID,
      ...options,
    })
    this.appList.push(app)
    return app
  }

  async close() {
    await Promise.all(this.appList.map(app => app.stop()))
    this.server.close()
  }
}

export async function createWsServer(token?: string) {
  const cqhttpPort = await getPort({ port: Random.int(16384, 49152) })
  return new WsServer(cqhttpPort, token)
}

export class WsServer extends MockedServer {
  server: ws.Server
  appList: App[] = []
  emitter = new EventEmitter()

  constructor(public cqhttpPort: number, public token?: string) {
    super()
    this.open()
  }

  open() {
    this.server = new ws.Server({ port: this.cqhttpPort })
    this.server.on('connection', (socket, req) => {
      if (this.token) {
        const signature = req.headers.authorization
        if (!signature || signature !== `Bearer ${this.token}`) {
          return socket.send('authorization failed', () => socket.close())
        }
      }

      socket.on('message', (raw) => {
        this.emitter.emit('message')
        const parsed = JSON.parse(raw.toString())
        const { action, params, echo } = parsed
        socket.send(JSON.stringify({ echo, ...this.receive(action, params) }))
      })
    })
  }

  nextTick(): Promise<void> {
    return new Promise(resolve => this.emitter.on('message', resolve))
  }

  async post(meta: Meta) {
    const data = snakeCase(meta)
    showTestLog('websocket post:', data)
    this.server.clients.forEach(socket => {
      if (socket.readyState !== ws.OPEN) return
      socket.send(JSON.stringify(data))
    })
    await Promise.all(this.appList.map(app => new Promise((resolve) => {
      (app.server as Server).socket.once('message', resolve)
    })))
  }

  createBoundApp(options: AppOptions = {}) {
    const app = new App({
      server: `ws://localhost:${this.cqhttpPort}`,
      selfId: BASE_SELF_ID,
      ...options,
    })
    this.appList.push(app)
    return app
  }

  async close() {
    await Promise.all(this.appList.map(app => app.stop()))
    this.server.close()
  }
}
