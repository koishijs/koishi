import ms from 'ms'
import WebSocket from 'ws'
import * as http from 'http'
import { errors } from './messages'
import { createHmac } from 'crypto'
import { camelCase, snakeCase, capitalize, paramCase, CQCode } from 'koishi-utils'
import { Meta, VersionInfo, ContextType } from './meta'
import { App } from './app'
import { CQResponse } from './sender'
import { format } from 'util'

export abstract class Server {
  public appList: App[] = []
  public version: VersionInfo
  public appMap: Record<number, App> = {}
  public isListening = false

  protected abstract _listen (): Promise<void>
  protected abstract _close (): void

  constructor (app: App) {
    this.bind(app)
  }

  /**
   * representative app
   */
  get app () {
    return this.appList[0]
  }

  protected debug (format: any, ...params: any[]) {
    this.app?.logger('koishi:server').debug(format, ...params)
  }

  protected prepareMeta (data: any) {
    const meta = camelCase<Meta>(data)
    if (!meta.selfId) {
      // below version 3.4
      meta.selfId = this.app.selfId
    } else if (!this.appMap[meta.selfId]) {
      const app = this.appList.find(app => !app.options.selfId)
      if (!app) return
      app.prepare(meta.selfId)
    }
    return meta
  }

  parseMeta (meta: Meta) {
    // prepare prefix
    let ctxType: ContextType, ctxId: number
    if (meta.groupId) {
      ctxType = 'group'
      ctxId = meta.groupId
    } else if (meta.discussId) {
      ctxType = 'discuss'
      ctxId = meta.discussId
    } else if (meta.userId) {
      ctxType = 'user'
      ctxId = meta.userId
    }

    // polyfill CQHTTP 3.x events and array form of message
    // https://cqhttp.cc/docs/4.12/#/UpgradeGuide
    /* eslint-disable dot-notation */
    if (meta.postType === 'message') {
      if (typeof meta.anonymous === 'string') {
        meta.anonymous = {
          name: meta.anonymous,
          flag: meta['anonymousFlag'],
        }
        delete meta['anonymousFlag']
      }
      if (Array.isArray(meta.message)) {
        meta.message = CQCode.stringifyAll(meta.message)
      }
    // @ts-ignore
    } else if (meta.postType === 'event') {
      meta.postType = 'notice'
      meta.noticeType = meta['event']
      delete meta['event']
    } else if (meta.postType === 'request' && meta.message) {
      meta.comment = meta.message
      delete meta.message
    }
    /* eslint-enable dot-notation */

    // prepare events
    const events: string[] = []
    if (meta.postType === 'message' || meta.postType === 'send') {
      events.push(meta.postType)
    } else if (meta.postType === 'request') {
      events.push('request/' + meta.requestType)
    } else if (meta.postType === 'notice') {
      events.push(meta.noticeType)
    } else {
      events.push(meta.metaEventType)
    }
    if (meta.subType) events.unshift(events[0] + '/' + meta.subType)

    // generate path
    Object.defineProperty(meta, '$ctxId', { value: ctxId })
    Object.defineProperty(meta, '$ctxType', { value: ctxType })

    const app = this.appMap[meta.selfId]
    Object.defineProperty(meta, '$app', { value: app })

    // add context properties
    if (meta.postType === 'message') {
      if (meta.messageType === 'group') {
        meta.$delete = async () => {
          if (meta.$response) return meta.$response({ delete: true })
          return app.sender.deleteMsgAsync(meta.messageId)
        }
        meta.$ban = async (duration = 30 * 60) => {
          if (meta.$response) return meta.$response({ ban: true, banDuration: duration })
          return meta.anonymous
            ? app.sender.setGroupAnonymousBanAsync(meta.groupId, meta.anonymous.flag, duration)
            : app.sender.setGroupBanAsync(meta.groupId, meta.userId, duration)
        }
        meta.$kick = async () => {
          if (meta.$response) return meta.$response({ kick: true })
          if (meta.anonymous) return
          return app.sender.setGroupKickAsync(meta.groupId, meta.userId)
        }
      }
      meta.$send = async (message, autoEscape = false) => {
        if (meta.$response) {
          app.emitEvent(meta, 'before-send', app.sender._createSendMeta(meta.messageType, ctxType, ctxId, message))
          return meta.$response({ reply: message, autoEscape, atSender: false })
        }
        return app.sender[`send${capitalize(meta.messageType)}MsgAsync`](ctxId, message, autoEscape)
      }
    } else if (meta.postType === 'request') {
      meta.$approve = async (remark = '') => {
        if (meta.$response) return meta.$response({ approve: true, remark })
        return meta.requestType === 'friend'
          ? app.sender.setFriendAddRequestAsync(meta.flag, remark)
          : app.sender.setGroupAddRequestAsync(meta.flag, meta.subType as any, true)
      }
      meta.$reject = async (reason = '') => {
        if (meta.$response) return meta.$response({ approve: false, reason })
        return meta.requestType === 'friend'
          ? app.sender.setFriendAddRequestAsync(meta.flag, false)
          : app.sender.setGroupAddRequestAsync(meta.flag, meta.subType as any, reason)
      }
    }

    return events
  }

  dispatchMeta (meta: Meta) {
    const app = this.appMap[meta.selfId]
    const events = this.parseMeta(meta)
    for (const event of events) {
      app.emitEvent(meta, paramCase(event) as any, meta)
    }
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
    this.isListening = true
    try {
      await this._listen()
      if (this.versionLessThan(3)) {
        throw new Error(errors.UNSUPPORTED_CQHTTP_VERSION)
      } else if (this.versionLessThan(3, 4)) {
        const apps = this.appList.filter(app => app.options.type && !app.selfId)
        if (apps.length > 1) throw new Error(errors.MULTIPLE_ANONYMOUS_BOTS)
        const info = await apps[0].sender.getLoginInfo()
        apps[0].prepare(info.userId)
      }
    } catch (error) {
      this.close()
      throw error
    }
  }

  close () {
    this.version = undefined
    this.isListening = false
    this._close()
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
        this.debug('receive %o', data)
        const meta = this.prepareMeta(data)
        if (!meta) {
          res.statusCode = 403
          return res.end()
        }

        // handle quick operations
        res.statusCode = 200
        const app = this.appMap[meta.selfId]
        if (app.options.quickOperationTimeout > 0) {
          meta.$response = (data) => {
            clearTimeout(timer)
            res.write(JSON.stringify(snakeCase(data)))
            res.end()
            meta.$response = null
          }
          const timer = setTimeout(() => {
            res.end()
            meta.$response = null
          }, app.options.quickOperationTimeout)
        } else {
          res.end()
        }

        // dispatch events
        this.dispatchMeta(meta)
      })
    })
  }

  async _listen () {
    this.debug('http server opening')
    const { port } = this.app.options
    this.server.listen(port)
    try {
      this.version = await this.app.sender.getVersionInfo()
    } catch (error) {
      throw new Error('authorization failed')
    }
    this.debug('http server listen to', port)
  }

  _close () {
    this.server.close()
    this.debug('http server closed')
  }
}

let counter = 0

export class WsClient extends Server {
  public socket: WebSocket
  private _retryCount = 0
  private _listeners: Record<number, (response: CQResponse) => void> = {}

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
    const connect = (resolve: () => void, reject: (reason: Error) => void) => {
      this.debug('websocket client opening')
      const headers: Record<string, string> = {}
      const { token, server, retryInterval, retryTimes } = this.app.options
      if (token) headers.Authorization = `Bearer ${token}`
      this.socket = new WebSocket(server, { headers })

      this.socket.on('error', error => this.debug(error))

      this.socket.once('close', (code) => {
        if (!this.isListening || code === 1005) return

        const message = `failed to connect to ${server}`
        if (!retryInterval || this._retryCount >= retryTimes) {
          return reject(new Error(message))
        }

        this._retryCount++
        this.debug(`${message}, will retry in ${ms(retryInterval)}...`)
        setTimeout(() => {
          if (this.isListening) connect(resolve, reject)
        }, retryInterval)
      })

      this.socket.once('open', () => {
        this._retryCount = 0

        this.socket.send(JSON.stringify({
          action: 'get_version_info',
          echo: -1,
        }), (error) => {
          if (error) reject(error)
        })

        this.socket.on('message', (data) => {
          data = data.toString()
          this.debug('receive', data)
          let parsed: any
          try {
            parsed = JSON.parse(data)
          } catch (error) {
            return reject(new Error(data))
          }

          if ('post_type' in parsed) {
            const meta = this.prepareMeta(parsed)
            if (meta) this.dispatchMeta(meta)
          } else if (parsed.echo === -1) {
            this.version = camelCase(parsed.data)
            this.debug('connect to ws server:', this.app.options.server)
            resolve()
          } else {
            this._listeners[parsed.echo]?.(parsed)
          }
        })
      })
    }
    return new Promise(connect)
  }

  _close () {
    this.socket.close()
    this._retryCount = 0
    this.debug('websocket client closed')
  }
}

export type ServerType = 'http' | 'ws' // 'ws-reverse'

export const serverMap: Record<ServerType, Record<keyof any, Server>> = { http: {}, ws: {} }

export function createServer (app: App) {
  if (typeof app.options.type !== 'string') {
    throw new Error(errors.UNSUPPORTED_SERVER_TYPE)
  }
  app.options.type = app.options.type.toLowerCase() as any
  let key: keyof any, Server: new (app: App) => Server
  if (app.options.type === 'http') {
    key = 'port'
    Server = HttpServer
  } else if (app.options.type === 'ws') {
    key = 'server'
    Server = WsClient
  } else {
    throw new Error(errors.UNSUPPORTED_SERVER_TYPE)
  }
  const servers = serverMap[app.options.type]
  const value = app.options[key]
  if (!value) {
    throw new Error(format(errors.MISSING_CONFIGURATION, key))
  }
  if (value in servers) {
    return servers[value].bind(app)
  }
  return servers[value] = new Server(app)
}
