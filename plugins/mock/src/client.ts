import assert from 'assert'
import { App, Session } from 'koishi'
import { format } from 'util'
import { MockAdapter } from './adapter'

const RECEIVED_UNEXPECTED = 'expected "%s" to be not replied but received "%s"'
const RECEIVED_NOTHING = 'expected "%s" to be replied but received nothing'
const RECEIVED_OTHERWISE = 'expected "%s" to be replied with %s but received "%s"'
const RECEIVED_NTH_NOTHING = 'expected "%s" to be replied at index %s but received nothing'
const RECEIVED_NTH_OTHERWISE = 'expected "%s" to be replied with %s at index %s but received "%s"'

export class MessageClient {
  public app: App
  public meta: Session.Payload

  private replies: string[] = []

  constructor(public mock: MockAdapter, public userId: string, public channelId?: string) {
    this.app = mock.ctx.app
    this.meta = {
      platform: 'mock',
      type: 'message',
      selfId: mock.bots[0].selfId,
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

  async receive(content: string) {
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
        const session = await this.app.bots[0].session({ ...this.meta, content })
        if (!session?.content) return []
        this.replies.push(session.content)
        return []
      }
      const dispose = this.app.on('middleware', (session) => {
        if (session.id === uuid) process.nextTick(_resolve)
      })
      const uuid = this.mock.receive({ ...this.meta, send, content })
    })
  }

  async shouldReply(message: string, reply?: string | RegExp | (string | RegExp)[]) {
    const result = await this.receive(message)

    function match(reply: string | RegExp, content: string) {
      return typeof reply === 'string' ? reply === content : reply.test(content)
    }

    function prettify(reply: string | RegExp) {
      return typeof reply === 'string' ? `"${reply}"` : reply.toString()
    }

    if (!reply) {
      assert.ok(result.length, format(RECEIVED_NOTHING, message))
      return
    }

    if (!Array.isArray(reply)) {
      assert.ok(result.length, format(RECEIVED_NOTHING, message))
      assert.ok(result.some(match.bind(null, reply)), format(RECEIVED_OTHERWISE, message, prettify(reply), result))
      return
    }

    for (const index in reply) {
      const expected = reply[index]
      const actual = result[index]
      assert.ok(actual, format(RECEIVED_NTH_NOTHING, message, index))
      assert.ok(match(expected, actual), format(RECEIVED_NTH_OTHERWISE, message, prettify(expected), index, actual))
    }
  }

  async shouldNotReply(message: string) {
    const result = await this.receive(message)
    assert.ok(!result.length, format(RECEIVED_UNEXPECTED, message, result))
  }
}
