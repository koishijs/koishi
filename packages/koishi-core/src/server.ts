import WebSocket from 'ws'
import debug from 'debug'
import * as http from 'http'
import * as errors from './errors'
import { createHmac } from 'crypto'
import { camelCase } from 'koishi-utils'
import { Meta, VersionInfo } from './meta'
import { App, AppOptions } from './app'
import { CQResponse } from './sender'

const showServerLog = debug('koishi:server')

// @ts-ignore: @types/debug does not include the property
showServerLog.inspectOpts.depth = 0

export abstract class Server {
  public appList: App[] = []
  public version: VersionInfo
  public appMap: Record<number, App> = {}
  private _isListening = false

  protected abstract _listen (): Promise<void>
  abstract close (): void

  constructor (app: App) {
    this.bind(app)
  }

  protected _handleData (data: any) {
    const meta = camelCase<Meta>(data)
    if (!this.appMap[meta.selfId]) {
      const app = this.appList.find(app => !app.options.selfId)
      if (!app) return
      app.options.selfId = meta.selfId
      app._registerSelfId()
    }
    const app = this.appMap[meta.selfId]
    app.dispatchMeta(meta)
    return true
  }

  bind (app: App) {
    this.appList.push(app)
    if (app.options.selfId) {
      this.appMap[app.options.selfId] = app
    }
    return this
  }

  async listen () {
    if (this._isListening) return
    this._isListening = true
    await this._listen()
    if (this.version.pluginMajorVersion < 3 || this.version.pluginMajorVersion > 4) {
      throw new Error(errors.UNSUPPORTED_CQHTTP_VERSION)
    }
    for (const app of this.appList) {
      app.receiver.emit('connect')
      app.receiver.emit('connected')
    }
  }
}

export class HttpServer extends Server {
  public server: http.Server

  constructor (app: App) {
    super(app)

    this.server = http.createServer((req, res) => {
      let body = ''
      req.on('data', chunk => body += chunk)
      req.on('end', () => {
        if (app.options.secret) {
          const signature = req.headers['x-signature']
          if (!signature) {
            res.statusCode = 401
            return res.end()
          }
          const sig = createHmac('sha1', app.options.secret).update(body).digest('hex')
          if (signature !== `sha1=${sig}`) {
            res.statusCode = 403
            return res.end()
          }
        }
        const data = JSON.parse(body)
        showServerLog('receive %o', data)
        const valid = this._handleData(data)
        res.statusCode = valid ? 200 : 403
        res.end()
      })
    })
  }

  async _listen () {
    const { port } = this.appList[0].options
    this.server.listen(port)
    if (this.appList[0].options.server) {
      try {
        this.version = await this.appList[0].sender.getVersionInfo()
      } catch (error) {
        throw new Error('authorization failed')
      }
    }
    showServerLog('listen to port', port)
  }

  close () {
    if (this.server) this.server.close()
    showServerLog('http server closed')
  }
}

let counter = 0

export class WsClient extends Server {
  public socket: WebSocket
  private _listeners: Record<number, (response: CQResponse) => void> = {}

  constructor (app: App) {
    super(app)

    this.socket = new WebSocket(app.options.server, {
      headers: {
        Authorization: `Bearer ${app.options.token}`,
      },
    })
  }

  send (data: any): Promise<CQResponse> {
    data.echo = ++counter
    return new Promise((resolve, reject) => {
      this._listeners[counter] = resolve
      this.socket.send(JSON.stringify(data), (error) => {
        if (error) reject(error)
      })
    })
  }

  _listen (): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.once('error', reject)

      this.socket.once('open', () => {
        this.socket.send(JSON.stringify({
          action: 'get_version_info',
          echo: -1,
        }), (error) => {
          if (error) reject(error)
        })

        let resolved = false
        this.socket.on('message', (data) => {
          data = data.toString()
          let parsed: any
          try {
            parsed = JSON.parse(data)
          } catch (error) {
            throw new Error(data)
          }
          if (!resolved) {
            resolved = true
            const { server: wsServer } = this.appList[0].options
            showServerLog('connect to ws server:', wsServer)
            resolve()
          }
          if ('post_type' in parsed) {
            this._handleData(parsed)
          } else {
            if (parsed.echo === -1) {
              this.version = camelCase(parsed.data)
            }
            if (parsed.echo in this._listeners) {
              this._listeners[parsed.echo](parsed)
            }
          }
        })
      })
    })
  }

  close () {
    if (this.socket) this.socket.close()
    showServerLog('ws client closed')
  }
}

export type ServerType = 'http' | 'ws' // 'ws-reverse'

const serverTypes: Record<ServerType, [keyof AppOptions, Record<keyof any, Server>, new (app: App) => Server]> = {
  http: ['port', {}, HttpServer],
  ws: ['server', {}, WsClient],
}

export function createServer (app: App) {
  const { type } = app.options
  if (!type) {
    throw new Error('missing configuration "type"')
  }
  if (!serverTypes[type]) {
    throw new Error(`server type "${type}" is not supported`)
  }
  const [key, serverMap, Server] = serverTypes[type]
  const value = app.options[key] as any
  if (!value) {
    throw new Error(`missing configuration "${key}"`)
  }
  if (value in serverMap) {
    return serverMap[value].bind(app)
  }
  return serverMap[value] = new Server(app)
}
