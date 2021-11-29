import { App, Adapter, Session, Bot, pick, Dict, Schema } from 'koishi'
import { assert } from 'chai'
import { Socket } from 'net'
import { format } from 'util'
import * as http from 'http'

export const BASE_SELF_ID = '514'

interface MockedResponse {
  code: number
  body: string
  headers: Dict<any>
}

declare module 'koishi' {
  interface User {
    mock: string
  }
}

interface BotConfig extends Bot.BaseConfig {
  selfId: string
}

class MockedBot extends Bot<BotConfig> {
  static schema: Schema<AdapterConfig> = Schema.object({})

  constructor(adapter: MockedServer, config: BotConfig) {
    super(adapter, config)
    this.selfId = config.selfId
    this.status = 'online'
  }

  async getMessage(channelId: string, messageId: string) {
    return {
      messageId,
      channelId,
      content: '',
      time: 0,
      subtype: null,
      messageType: null,
      author: { userId: this.selfId } as Bot.Author,
    }
  }
}

interface AdapterConfig {}

class MockedServer extends Adapter<BotConfig, AdapterConfig> {
  static schema: Schema<BotConfig> = Schema.object({
    selfId: Schema.string(),
  })

  constructor(app: MockedApp, config: AdapterConfig) {
    super(app, config)
    app.server = this
  }

  connect() {}

  stop() {}

  start() {}

  get(path: string, headers?: Dict<any>) {
    return this.receive('GET', path, headers, '')
  }

  post(path: string, body: any, headers?: Dict<any>) {
    return this.receive('POST', path, {
      ...headers,
      'content-type': 'application/json',
    }, JSON.stringify(body))
  }

  receive(method: string, path: string, headers: Dict<any>, content: string) {
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
      this.ctx.app._httpServer.emit('request', req, res)
      req.emit('data', content)
      req.emit('end')
    })
  }
}

const mocker = Adapter.define('mock', MockedBot, MockedServer)

interface MockedAppOptions extends App.Config {
  mockStart?: boolean
}

export class MockedApp extends App {
  public server: MockedServer

  constructor(options: MockedAppOptions = {}) {
    super(options)

    this.plugin(mocker, {
      selfId: BASE_SELF_ID,
    })

    if (options.mockStart !== false) {
      this.start()
    }
  }

  get selfId() {
    return this.bots[0].selfId
  }

  receive(meta: Partial<Session>) {
    const session = new Session(this.bots[0], meta)
    this.server.dispatch(session)
    return session.id
  }

  session(userId: string, channelId?: string) {
    return new TestSession(this, userId, channelId)
  }

  async initUser(id: string, authority = 1) {
    await this.database.create('user', { mock: id, authority })
  }

  async initChannel(id: string, assignee = this.selfId) {
    await this.database.create('channel', { platform: 'mock', id, assignee })
  }
}

export class TestSession {
  public meta: Partial<Session.Message>

  private replies: string[] = []

  constructor(public app: MockedApp, public userId: string, public channelId?: string) {
    this.meta = {
      platform: 'mock',
      type: 'message',
      selfId: app.selfId,
      userId,
      author: {
        userId,
        username: '' + userId,
      },
    }

    if (channelId) {
      this.meta.guildId = channelId
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
        const session = this.app.bots[0].createSession(pick(this.meta, ['userId', 'channelId', 'guildId']))
        session.content = content
        this.app.emit(session as any, 'before-send', session)
        const length = this.replies.push(content)
        if (length >= count) _resolve()
      }
      const dispose = this.app.on('middleware', (session) => {
        if (session.id === uuid) process.nextTick(_resolve)
      })
      const uuid = this.app.receive({ ...this.meta, send, content })
    })
  }

  async shouldReply(message: string, reply?: string | RegExp | (string | RegExp)[]) {
    if (!reply) {
      const result = await this.receive(message)
      return assert.ok(result.length, format(RECEIVED_NOTHING, message))
    }

    if (!Array.isArray(reply)) reply = [reply]
    const result = await this.receive(message, reply.length)
    for (const index in reply) {
      const expected = reply[index]
      const actual = result[index]
      assert.ok(actual, format(RECEIVED_NOTHING, message))
      if (typeof expected === 'string') {
        assert.strictEqual(actual, expected, format(RECEIVED_OTHERWISE, message, `"${expected}"`, actual))
      } else {
        assert.match(actual, expected, format(RECEIVED_OTHERWISE, message, expected.toString(), actual))
      }
    }
  }

  async shouldNotReply(message: string) {
    const result = await this.receive(message)
    assert.ok(!result.length, `expected "${message}" to have no reply but received "${result[0]}"`)
  }
}

const RECEIVED_NOTHING = 'expected "%s" to be replied but received nothing'
const RECEIVED_OTHERWISE = 'expected "%s" to be replied with %s but received "%s"'

export { MockedApp as App }
