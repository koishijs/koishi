import WebSocket from 'ws'
import debug from 'debug'
import * as http from 'http'
import * as errors from './errors'
import { createHmac } from 'crypto'
import { camelCase, snakeCase } from 'koishi-utils'
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
  public isListening = false

  protected abstract _listen (): Promise<void>
  abstract close (): void

  constructor (app: App) {
    this.bind(app)
  }

  protected _handleMeta (data: any) {
    const meta = camelCase<Meta>(data)
    if (!meta.selfId) {
      // below version 3.4
      meta.selfId = this.appList[0].selfId
    } else if (!this.appMap[meta.selfId]) {
      const app = this.appList.find(app => !app.options.selfId)
      if (!app) return
      app._registerSelfId(meta.selfId)
    }
    return meta
  }

  bind (app: App) {
    this.appList.push(app)
    if (app.options.selfId) {
      this.appMap[app.options.selfId] = app
    }
    return this
  }

  versionLessThan (major: number, minor: number = 0, patch: number = 0) {
    const { pluginMajorVersion, pluginMinorVersion, pluginPatchVersion } = this.version
    return pluginMajorVersion < major || pluginMajorVersion === major &&
      (pluginMinorVersion < minor || pluginMinorVersion === minor && pluginPatchVersion < patch)
  }

  async listen () {
    if (this.isListening) return
    await this._listen()
    this.isListening = true
    if (this.versionLessThan(3)) {
      throw new Error(errors.UNSUPPORTED_CQHTTP_VERSION)
    } else if (this.versionLessThan(3, 4)) {
      const apps = this.appList.filter(app => app.options.type && !app.selfId)
      if (apps.length > 1) throw new Error(errors.MULTIPLE_ANONYMOUS_BOTS)
      const info = await apps[0].sender.getLoginInfo()
      apps[0]._registerSelfId(info.userId)
    }
  }
}

export class HttpServer extends Server {
  public server: http.Server

  constructor (app: App) {
    super(app)

    const { secret } = app.options
    this.server = http.createServer((req, res) => {
      let body = ''
      req.on('data', chunk => body += chunk)
      req.on('end', () => {
        if (secret) {
          // no signature
          const signature = req.headers['x-signature']
          if (!signature) {
            res.statusCode = 401
            return res.end()
          }

          // invalid signature
          const sig = createHmac('sha1', secret).update(body).digest('hex')
          if (signature !== `sha1=${sig}`) {
            res.statusCode = 403
            return res.end()
          }
        }

        // no matched application
        const data = JSON.parse(body)
        showServerLog('receive %o', data)
        const meta = this._handleMeta(data)
        if (!meta) {
          res.statusCode = 403
          return res.end()
        }

        // ok, dispatch events
        res.statusCode = 200
        const app = this.appMap[meta.selfId]
        if (app.options.quickOperationTimeout > 0) {
          // handle quick operations
          meta.$response = (data) => {
            clearTimeout(timer)
            res.write(JSON.stringify(snakeCase(data)))
            res.end()
            meta.$response = null
          }
          const timer = setTimeout(() => {
            if (!meta.$response) return
            res.end()
            meta.$response = null
          }, app.options.quickOperationTimeout)
        } else {
          res.end()
        }
        app.dispatchMeta(meta)
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
            const { server } = this.appList[0].options
            showServerLog('connect to ws server:', server)
            resolve()
          }
          if ('post_type' in parsed) {
            const meta = this._handleMeta(parsed)
            if (meta) this.appMap[meta.selfId].dispatchMeta(meta)
          } else {
            if (parsed.echo === -1) {
              this.version = camelCase(parsed.data)
            }
            this._listeners[parsed.echo]?.(parsed)
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
  if (typeof app.options.type !== 'string') {
    throw new Error(errors.UNSUPPORTED_SERVER_TYPE)
  }
  app.options.type = app.options.type.toLowerCase() as any
  if (!serverTypes[app.options.type]) {
    throw new Error(errors.UNSUPPORTED_SERVER_TYPE)
  }
  const [key, serverMap, Server] = serverTypes[app.options.type]
  const value = app.options[key] as any
  if (!value) {
    throw new Error(`missing configuration "${key}"`)
  }
  if (value in serverMap) {
    return serverMap[value].bind(app)
  }
  return serverMap[value] = new Server(app)
}
