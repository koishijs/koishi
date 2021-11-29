import { assert } from 'chai'
import { App, pick, Session } from 'koishi'
import { format } from 'util'
import { Tester } from './adapter'

const RECEIVED_NOTHING = 'expected "%s" to be replied but received nothing'
const RECEIVED_OTHERWISE = 'expected "%s" to be replied with %s but received "%s"'

export class Client {
  public app: App
  public meta: Partial<Session.Message>

  private replies: string[] = []

  constructor(public mocker: Tester, public userId: string, public channelId?: string) {
    this.app = mocker.ctx.app
    this.meta = {
      platform: 'mock',
      type: 'message',
      selfId: mocker.bots[0].selfId,
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
      const uuid = this.mocker.receive({ ...this.meta, send, content })
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
