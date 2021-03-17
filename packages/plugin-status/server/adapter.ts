import { Adapter, Bot, BotOptions, Context, Logger, omit, pick, Random, Session, Time, User } from 'koishi-core'
import Profile from './profile'
import WebSocket from 'ws'

const logger = new Logger('status')
const states: Record<string, [string, number, WebBot]> = {}

const TOKEN_TIMEOUT = Time.minute * 10

export class WebBot extends Bot<'sandbox'> {
  adapter: WebAdapter

  constructor(adapter: WebAdapter, options: BotOptions) {
    super(adapter, options)
    Profile.initBot(this)
  }

  async sendMessage(channelId: string, content: string) {
    this._send('sandbox', content)
    return Random.uuid()
  }

  // websocket api

  _send(type: string, body?: any) {
    this.socket.send(JSON.stringify({ type, body }))
  }

  async $token({ platform, userId }) {
    const user = await this.app.database.getUser(platform, userId, ['name'])
    if (!user) return this._send('login', { message: '找不到此账户。' })
    const id = `${platform}:${userId}`
    const token = Random.uuid()
    const expire = Date.now() + TOKEN_TIMEOUT
    states[id] = [token, expire, this]
    setTimeout(() => {
      if (states[id]?.[1] > Date.now()) delete states[id]
    }, TOKEN_TIMEOUT)
    this._send('login', { token, name: user.name })
  }

  async _validate<T extends User.Field>(id: string, token: string, fields: T[] = []) {
    const user = await this.app.database.getUser('id', id, ['token', 'expire', ...fields])
    if (token !== user.token || user.expire <= Date.now()) {
      this._send('expire')
      return
    }
    return user
  }

  async $password({ id, token, password }) {
    const user = await this._validate(id, token, ['password'])
    if (password === user.password) return
    await this.app.database.setUser('id', id, { password })
  }

  async $login({ username, password }) {
    const user = await this.app.database.getUser('name', username, ['password', 'authority', 'id', 'expire', 'token'])
    if (!user || user.password !== password) {
      return this._send('login', { message: '用户名或密码错误。' })
    }
    user.token = Random.uuid()
    user.expire = Date.now() + this.adapter.config.expiration
    await this.app.database.setUser('name', username, pick(user, ['token', 'expire']))
    this._send('user', omit(user, ['password']))
  }

  async $sandbox({ id, token, content }) {
    const user = await this._validate(id, token, ['name'])
    const session = new Session(this.app, {
      platform: 'sandbox',
      userId: id,
      content,
      selfId: this.selfId,
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

export namespace WebAdapter {
  export interface Config {
    path?: string
    expiration?: number
  }
}

export class WebAdapter extends Adapter<'sandbox'> {
  server: WebSocket.Server

  constructor(ctx: Context, public config: WebAdapter.Config) {
    super(ctx.app, WebBot)
    this.server = new WebSocket.Server({
      path: config.path,
      server: ctx.app._httpServer,
    })

    ctx.all().middleware(async (session, next) => {
      if (session.subtype !== 'private') return next()
      const state = states[session.uid]
      if (state && state[0] === session.content) {
        const user = await session.observeUser(['id', 'name', 'authority', 'token', 'expire'])
        user.token = Random.uuid()
        user.expire = Date.now() + config.expiration
        return state[2]._send('user', user)
      }
      return next()
    }, true)
  }

  async start() {
    this.server.on('connection', async (socket) => {
      const bot = this.create({ type: 'sandbox', selfId: Random.uuid() })
      bot.socket = socket
      bot.username = '沙箱机器人'
      bot.status = Bot.Status.GOOD

      socket.on('close', () => {
        bot.dispose()
        for (const id in states) {
          if (states[id][2] === bot) delete states[id]
        }
      })

      socket.on('message', async (data) => {
        const { type, body } = JSON.parse(data.toString())
        const method = bot['$' + type]
        if (method) {
          method.call(bot, body)
        } else {
          logger.info(type, body)
        }
      })
    })
  }

  stop() {
    this.server.close()
  }
}
