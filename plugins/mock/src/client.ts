import assert from 'assert'
import { clone, Context, Dict, h, hyphenate, isNullable, MessageEncoder, Universal } from 'koishi'
import { format } from 'util'
import { MockBot } from './adapter'

const RECEIVED_UNEXPECTED = 'expected "%s" to be not replied but received "%s"'
const RECEIVED_NOTHING = 'expected "%s" to be replied but received nothing'
const RECEIVED_OTHERWISE = 'expected "%s" to be replied with %s but received "%s"'
const RECEIVED_NTH_NOTHING = 'expected "%s" to be replied at index %s but received nothing'
const RECEIVED_NTH_OTHERWISE = 'expected "%s" to be replied with %s at index %s but received "%s"'

export class MockMessenger extends MessageEncoder<Context, MockBot> {
  private buffer = ''

  constructor(private client: MessageClient, options?: Universal.SendOptions) {
    super(client.bot, client.event.channel.id, client.event.guild?.id, options)
  }

  async flush() {
    this.buffer = this.buffer.trim()
    if (!this.buffer) return
    this.client.flush(this.buffer)
    this.buffer = ''
  }

  async visit(element: h) {
    const { type, attrs, children } = element
    if (type === 'message' || type === 'figure') {
      await this.flush()
      await this.render(children)
      await this.flush()
    } else if (type === 'text') {
      this.buffer += attrs.content
    } else if (type === 'p') {
      if (!this.buffer.endsWith('\n')) this.buffer += '\n'
      await this.render(children)
      if (!this.buffer.endsWith('\n')) this.buffer += '\n'
    } else if (type === 'template' || !type) {
      await this.render(children)
    } else {
      const attrString = Object.entries(attrs).map(([key, value]) => {
        if (isNullable(value)) return ''
        key = hyphenate(key)
        if (value === true) return ` ${key}`
        if (value === false) return ` no-${key}`
        return ` ${key}="${h.escape('' + value, true)}"`
      }).join('')
      this.buffer += `<${type}${attrString}>`
      const length = this.buffer.length
      await this.render(children)
      if (this.buffer.length === length) {
        this.buffer = this.buffer.slice(0, -1) + `/>`
      } else {
        this.buffer += `</${type}>`
      }
    }
  }
}

interface Hook {
  count: number
  done?: boolean
  resolve?: (replies: string[]) => void
}

let counter = 0

export class MessageClient {
  public app: Context
  public event: Universal.Event

  private replies: string[] = []
  private hooks: Dict<Hook> = {}

  constructor(public bot: MockBot, public userId: string, public channelId?: string) {
    this.app = bot.ctx.root
    this.event = {
      platform: 'mock',
      type: 'message',
      selfId: bot.selfId,
      user: { id: userId, name: '' + userId },
    } as Universal.Event

    if (channelId) {
      this.event.guild = { id: channelId }
      this.event.channel = { id: channelId, type: Universal.Channel.Type.TEXT }
    } else {
      this.event.channel = { id: 'private:' + userId, type: Universal.Channel.Type.DIRECT }
    }

    this.app.on('middleware', (session) => {
      const hook = this.hooks[session.id]
      if (!hook) return
      hook.done = true
      if (!hook.resolve) delete this.hooks[session.id]
      if (Object.values(this.hooks).every(hook => hook.done)) {
        this.flush()
        this.hooks = {}
      }
    })
  }

  flush(buffer?: string) {
    if (buffer) this.replies.push(buffer)
    for (const id in this.hooks) {
      const hook = this.hooks[id]
      if (!hook.resolve || buffer && this.replies.length < hook.count) continue
      hook.resolve(this.replies)
      hook.resolve = undefined
      hook.count = Infinity
      this.replies = []
    }
  }

  async receive(content: string, count = Infinity) {
    const result = await new Promise<string[]>((resolve) => {
      let quote: Universal.Message
      let elements = h.parse(content)
      if (elements[0]?.type === 'quote') {
        const { attrs, children } = elements.shift()
        quote = { id: attrs.id, messageId: attrs.id, elements: children, content: children.join('') }
        content = elements.join('').trimStart()
        elements = h.parse(content)
      }
      const id = this.bot.receive({
        ...clone(this.event),
        message: { id: ++counter + '', content, elements, quote },
      }, this)
      this.hooks[id] = { resolve, count }
    })
    // Await for next tick to ensure subsequent operations are executed.
    // Do not use `setTimeout` because it may break tests with mocked timers.
    await new Promise(process.nextTick)
    return result
  }

  async shouldReply(message: string, reply?: string | RegExp | (string | RegExp)[]) {
    function match(reply: string | RegExp, content: string) {
      return typeof reply === 'string' ? reply === content : reply.test(content)
    }

    function prettify(reply: string | RegExp) {
      return typeof reply === 'string' ? `"${reply}"` : reply.toString()
    }

    if (!reply) {
      const result = await this.receive(message)
      assert.ok(result.length, format(RECEIVED_NOTHING, message))
      return
    }

    if (!Array.isArray(reply)) {
      const [result] = await this.receive(message, 1)
      assert.ok(result, format(RECEIVED_NOTHING, message))
      assert.ok(match(reply, result), format(RECEIVED_OTHERWISE, message, prettify(reply), result))
      return
    }

    const result = await this.receive(message)
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
