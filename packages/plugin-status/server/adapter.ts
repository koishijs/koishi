import { Adapter, App, Bot, Context, Logger, omit, pick, Random, Session, Time, User } from 'koishi-core'
import { Profile } from './profile'
import WebSocket from 'ws'

const logger = new Logger('status')
const states: Record<string, [string, number, SocketChannel]> = {}

const TOKEN_TIMEOUT = Time.minute * 10

class SocketChannel {
  readonly app: App
  readonly id = Random.uuid()

  constructor(public readonly adapter: WebAdapter, public socket: WebSocket) {
    this.app = adapter.app
  }

  send(type: string, body?: any) {
    this.socket.send(JSON.stringify({ type, body }))
  }

  async $token({ platform, userId }) {
    const user = await this.app.database.getUser(platform, userId, ['name'])
    if (!user) return this.send('login', { message: '找不到此账户。' })
    const id = `${platform}:${userId}`
    const token = Random.uuid()
    const expire = Date.now() + TOKEN_TIMEOUT
    states[id] = [token, expire, this]
    setTimeout(() => {
      if (states[id]?.[1] > Date.now()) delete states[id]
    }, TOKEN_TIMEOUT)
    this.send('login', { token, name: user.name })
  }

  async validate<T extends User.Field>(id: string, token: string, fields: T[] = []) {
    const user = await this.app.database.getUser('id', id, ['token', 'expire', ...fields])
    if (!user || token !== user.token || user.expire <= Date.now()) {
      return this.send('expire')
    }
    return user
  }

  async $password({ id, token, password }) {
    const user = await this.validate(id, token, ['password'])
    if (!user || password === user.password) return
    await this.app.database.setUser('id', id, { password })
  }

  async $login({ username, password }) {
    const user = await this.app.database.getUser('name', username, ['password', 'authority', 'id', 'expire', 'token'])
    if (!user || user.password !== password) {
      return this.send('login', { message: '用户名或密码错误。' })
    }
    user.token = Random.uuid()
    user.expire = Date.now() + this.adapter.config.expiration
    await this.app.database.setUser('name', username, pick(user, ['token', 'expire']))
    this.send('user', omit(user, ['password']))
  }

  async $sandbox({ id, token, content }) {
    const user = await this.validate(id, token, ['name'])
    if (!user) return
    const session = new Session(this.app, {
      platform: 'web',
      userId: id,
      content,
      channelId: this.id,
      selfId: 'sandbox',
      type: 'message',
      subtype: 'private',
      author: {
        userId: 'id',
        username: user.name,
      },
    })
    session.platform = 'id' as never
    this.adapter.dispatch(session)
  }
}

export class SandboxBot extends Bot<'web'> {
  username = 'sandbox'
  status = Bot.Status.GOOD

  constructor(public readonly adapter: WebAdapter) {
    super(adapter, { type: 'web', selfId: 'sandbox' })
    Profile.initBot(this)
  }

  async sendMessage(id: string, content: string) {
    this.adapter.channels[id]?.send('sandbox', content)
    return Random.uuid()
  }
}

export namespace WebAdapter {
  export interface Config {
    apiPath?: string
    expiration?: number
  }
}

export class WebAdapter extends Adapter<'web'> {
  server: WebSocket.Server
  channels: Record<string, SocketChannel> = {}
  sandbox = this.create({}, SandboxBot)

  constructor(ctx: Context, public config: WebAdapter.Config) {
    super(ctx.app)

    this.server = new WebSocket.Server({
      path: config.apiPath,
      server: ctx.app._httpServer,
    })

    ctx.all().middleware(async (session, next) => {
      if (session.subtype !== 'private') return next()
      const state = states[session.uid]
      if (state && state[0] === session.content) {
        const user = await session.observeUser(['id', 'name', 'authority', 'token', 'expire'])
        user.token = Random.uuid()
        user.expire = Date.now() + config.expiration
        return state[2].send('user', user)
      }
      return next()
    }, true)
  }

  async start() {
    this.server.on('connection', async (socket) => {
      const channel = new SocketChannel(this, socket)
      this.channels[channel.id] = channel

      socket.on('close', () => {
        delete this.channels[channel.id]
        for (const id in states) {
          if (states[id][2] === channel) delete states[id]
        }
      })

      socket.on('message', async (data) => {
        const { type, body } = JSON.parse(data.toString())
        const method = channel['$' + type]
        if (method) {
          method.call(channel, body)
        } else {
          logger.info(type, body)
        }
      })
    })
  }

  broadcast(type: string, body: any) {
    if (!this?.server.clients.size) return
    const data = JSON.stringify({ type, body })
    this.server.clients.forEach((socket) => socket.send(data))
  }

  stop() {
    this.server.close()
  }
}
