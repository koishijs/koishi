import { AppOptions, App, Server, Session, AppStatus } from 'koishi-core'
import { assert } from 'chai'
import { Socket } from 'net'
import * as http from 'http'
import * as memory from './memory'

export const BASE_SELF_ID = 514

interface MockedResponse {
  code: number
  body: string
  headers: Record<string, any>
}

class MockedServer extends Server {
  constructor(app: App) {
    super(app)
    this.bots.forEach(bot => bot.ready = true)
  }

  _close() {}

  async _listen() {}

  get(path: string, headers?: Record<string, any>) {
    return this.receive('GET', path, headers, '')
  }

  post(path: string, body: any, headers?: Record<string, any>) {
    return this.receive('POST', path, headers, JSON.stringify(body))
  }

  receive(method: string, path: string, headers: Record<string, any>, content: string) {
    const socket = new Socket()
    const req = new http.IncomingMessage(socket)
    req.url = path
    req.method = method
    Object.assign(req.headers, headers)
    req.headers['content-type'] = 'application/json'
    req.headers['content-length'] = '' + content.length
    return new Promise<MockedResponse>((resolve) => {
      const res = new http.ServerResponse(req)
      let body = ''
      res.write = (chunk: any) => {
        body += chunk
        return true
      }
      res.end = (chunk: any) => {
        res.write(chunk)
        const code = res.statusCode
        const headers = res.getHeaders()
        resolve({ code, body, headers })
      }
      this.server.emit('request', req, res)
      req.emit('data', content)
      req.emit('end')
    })
  }
}

Server.types.mock = MockedServer

interface MockedAppOptions extends AppOptions {
  mockStart?: boolean
  mockDatabase?: boolean
}

export class MockedApp extends App {
  public server: MockedServer

  constructor(options: MockedAppOptions = {}) {
    super({ selfId: BASE_SELF_ID, type: 'mock', ...options })
    if (options.mockStart !== false) this.status = AppStatus.open
    if (options.mockDatabase) this.plugin(memory)
  }

  get selfId() {
    return this.bots[0].selfId
  }

  receive(meta: Partial<Session>) {
    const session = new Session(this, {
      selfId: this.selfId,
      ...meta,
    })
    this.server.dispatch(session)
    return session.$uuid
  }

  session(userId: number, groupId?: number) {
    return new TestSession(this, userId, groupId)
  }
}

export class TestSession {
  public meta: Partial<Session>

  private replies: string[] = []

  constructor(public app: MockedApp, public userId: number, public groupId?: number) {
    this.meta = {
      postType: 'message',
      userId,
      sender: {
        sex: 'unknown',
        age: 0,
        userId,
        nickname: '' + userId,
      },
    }

    if (groupId) {
      this.meta.groupId = groupId
      this.meta.messageType = 'group'
    } else {
      this.meta.messageType = 'private'
    }
  }

  async receive(message: string, count?: number) {
    return new Promise<string[]>((resolve) => {
      let resolved = false
      const _resolve = () => {
        if (resolved) return
        resolved = true
        dispose()
        resolve(this.replies)
        this.replies = []
      }
      const $send = async (message: string) => {
        if (!message) return
        const length = this.replies.push(message)
        if (length >= count) _resolve()
      }
      const dispose = this.app.on('middleware', (session) => {
        if (session.$uuid === uuid) _resolve()
      })
      const uuid = this.app.receive({ ...this.meta, $send, message })
    })
  }

  async shouldReply(message: string, reply?: string | RegExp | (string | RegExp)[]) {
    if (!reply) {
      const result = await this.receive(message)
      return assert.ok(result.length, `expected "${message}" to be replied but not received nothing`)
    }

    if (!Array.isArray(reply)) reply = [reply]
    const result = await this.receive(message, reply.length)
    for (const index in reply) {
      const expected = reply[index]
      if (typeof expected === 'string') {
        assert.strictEqual(result[index], expected)
      } else {
        assert.match(result[index], expected)
      }
    }
  }

  async shouldNotReply(message: string) {
    const result = await this.receive(message)
    assert.ok(!result.length, `expected "${message}" to have no reply but received "${result[0]}"`)
  }
}

export { MockedApp as App }
