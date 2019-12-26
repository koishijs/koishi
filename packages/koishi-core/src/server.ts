import WebSocket from 'ws'
import debug from 'debug'
import * as http from 'http'
import { errors } from './messages'
import { createHmac } from 'crypto'
import { camelCase, snakeCase, capitalize, paramCase } from 'koishi-utils'
import { Meta, VersionInfo, ContextType } from './meta'
import { App, AppOptions } from './app'
import { CQResponse } from './sender'
import { format } from 'util'

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

  protected prepareMeta (data: any) {
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

  async dispatchMeta (meta: Meta) {
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

    // polyfill CQHTTP 3.x events
    // https://cqhttp.cc/docs/4.12/#/UpgradeGuide
    /* eslint-disable dot-notation */
    if (typeof meta.anonymous === 'string') {
      meta.anonymous = {
        name: meta.anonymous,
        flag: meta['anonymousFlag'],
      }
      delete meta['anonymousFlag']
    // @ts-ignore
    } else if (meta.postType === 'event') {
      meta.postType = 'notice'
      meta.noticeType = meta['event']
      delete meta['event']
    } else if (meta.postType === 'request') {
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
    const path = (ctxType ? `/${ctxType}/${ctxId}/` : '/') + events[0]
    Object.defineProperty(meta, '$path', { value: path })
    Object.defineProperty(meta, '$ctxId', { value: ctxId })
    Object.defineProperty(meta, '$ctxType', { value: ctxType })

    const app = this.appMap[meta.selfId]
    if (!app) return

    // add context properties
    if (meta.postType === 'message') {
      if (meta.messageType === 'group') {
        if (app.database) {
          Object.defineProperty(meta, '$group', {
            value: await app.database.getGroup(meta.groupId),
            writable: true,
          })
        }
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
          app.emitEvent(meta, 'before-send', app.sender._createSendMeta(ctxType, ctxId, message))
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

    // emit events
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
    await this._listen()
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
            if (!meta.$response) return
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
            const meta = this.prepareMeta(parsed)
            if (meta) this.dispatchMeta(meta)
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
    throw new Error(format(errors.MISSING_CONFIGURATION, key))
  }
  if (value in serverMap) {
    return serverMap[value].bind(app)
  }
  return serverMap[value] = new Server(app)
}
