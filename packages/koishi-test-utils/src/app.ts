import { AppOptions, App, Adapter, Session, Bot, AuthorInfo } from 'koishi-core'
import { assert } from 'chai'
import { Socket } from 'net'
import * as http from 'http'
import * as memory from './memory'

export const BASE_SELF_ID = '514'

interface MockedResponse {
  code: number
  body: string
  headers: Record<string, any>
}

declare module 'koishi-core/dist/adapter' {
  namespace Bot {
    interface Platforms {
      mock: MockedBot
    }
  }
}

class MockedBot extends Bot<'mock'> {
  async getMessage(messageId: string) {
    return {
      messageId,
      message: '',
      time: 0,
      realId: 0,
      subtype: null,
      messageType: null,
      author: { userId: this.selfId } as AuthorInfo,
    }
  }
}

class MockedServer extends Adapter {
  constructor(app: App) {
    super(app, MockedBot)
    this.bots.forEach(bot => bot.ready = true)
  }

  close() {}

  async listen() {}

  get(path: string, headers?: Record<string, any>) {
    return this.receive('GET', path, headers, '')
  }

  post(path: string, body: any, headers?: Record<string, any>) {
    return this.receive('POST', path, {
      ...headers,
      'content-type': 'application/json',
    }, JSON.stringify(body))
  }

  receive(method: string, path: string, headers: Record<string, any>, content: string) {
    const socket = new Socket()
    const req = new http.IncomingMessage(socket)
    req.url = path
    req.method = method
    Object.assign(req.headers, headers)
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
      this.app._httpServer.emit('request', req, res)
      req.emit('data', content)
      req.emit('end')
    })
  }
}

Adapter.types.mock = MockedServer

interface MockedAppOptions extends AppOptions {
  mockStart?: boolean
  mockDatabase?: boolean
}

export class MockedApp extends App {
  public server: MockedServer

  constructor(options: MockedAppOptions = {}) {
    super({ selfId: BASE_SELF_ID, type: 'mock', ...options })

    this.server = this.adapters.mock as any

    if (options.mockStart !== false) this.status = App.Status.open
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
    this.adapters.mock.dispatch(session)
    return session.$uuid
  }

  session(userId: string, channelId?: string) {
    return new TestSession(this, userId, channelId)
  }
}

export class TestSession {
  public meta: Partial<Session>

  private replies: string[] = []

  constructor(public app: MockedApp, public userId: string, public channelId?: string) {
    this.meta = {
      platform: 'mock',
      type: 'message',
      userId,
      author: {
        userId,
        username: '' + userId,
      },
    }

    if (channelId) {
      this.meta.groupId = channelId
      this.meta.channelId = channelId
      this.meta.subtype = 'group'
    } else {
      this.meta.channelId = 'private:' + userId
      this.meta.subtype = 'private'
    }
  }

  async receive(content: string, count?: number) {
    return new Promise<string[]>((resolve) => {
      let resolved = false
      const _resolve = () => {
        if (resolved) return
        resolved = true
        dispose()
        resolve(this.replies)
        this.replies = []
      }
      const send = async (content: string) => {
        if (!content) return
        const length = this.replies.push(content)
        if (length >= count) _resolve()
      }
      const dispose = this.app.on('middleware', (session) => {
        if (session.$uuid === uuid) process.nextTick(_resolve)
      })
      const uuid = this.app.receive({ ...this.meta, send, content })
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
