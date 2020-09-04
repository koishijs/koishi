import { AppOptions, App, Server, Session } from 'koishi-core'
import { assert } from 'chai'

export const BASE_SELF_ID = 514

class MockedAppServer extends Server {
  constructor(app: App) {
    super(app)
    this.bots.forEach(bot => bot.ready = true)
  }

  _close() {}

  async _listen() {}
}

Server.types.mock = MockedAppServer

export class MockedApp extends App {
  public server: MockedAppServer

  constructor(options: AppOptions = {}) {
    super({ selfId: BASE_SELF_ID, type: 'mock', ...options })
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
      const dispose = this.app.on('after-middleware', (session) => {
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
