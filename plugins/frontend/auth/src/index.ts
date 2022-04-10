import { Awaitable, Context, omit, pick, Schema, Time, User } from 'koishi'
import { DataService, SocketHandle } from '@koishijs/plugin-console'
import { resolve } from 'path'
import { v4 } from 'uuid'

declare module 'koishi' {
  interface User {
    password: string
    token: string
    expire: number
  }
}

declare module '@koishijs/plugin-console' {
  interface SocketHandle {
    user?: UserAuth
  }

  namespace Console {
    interface Services {
      user: AuthService
    }
  }

  interface Events {
    'login/platform'(this: SocketHandle, platform: string, userId: string): Awaitable<UserLogin>
    'login/password'(this: SocketHandle, name: string, password: string): void
    'login/token'(this: SocketHandle, id: string, token: string): void
    'user/update'(this: SocketHandle, data: UserUpdate): void
    'user/logout'(this: SocketHandle): void
  }
}

export type UserAuth = Pick<User, 'id' | 'name' | 'authority' | 'token' | 'expire'>
export type UserLogin = Pick<User, 'id' | 'name' | 'token' | 'expire'>
export type UserUpdate = Partial<Pick<User, 'name' | 'password'>>

const authFields = ['name', 'authority', 'id', 'expire', 'token'] as (keyof UserAuth)[]

function setAuthUser(handle: SocketHandle, value: UserAuth) {
  handle.user = value
  handle.send({ type: 'data', body: { key: 'user', value } })
  handle.refresh()
}

class AuthService extends DataService<UserAuth> {
  static using = ['console', 'database'] as const

  constructor(ctx: Context, private config: AuthService.Config) {
    super(ctx, 'user')

    ctx.model.extend('user', {
      password: 'string(63)',
      token: 'string(63)',
      expire: 'unsigned(20)',
    })

    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })

    this.initLogin()
  }

  initLogin() {
    const { ctx, config } = this
    const states: Record<string, [string, number, SocketHandle]> = {}

    ctx.console.addListener('login/password', async function (name, password) {
      const user = await ctx.database.getUser('name', name, ['password', ...authFields])
      if (!user || user.password !== password) throw new Error('用户名或密码错误。')
      if (!user.expire || user.expire < Date.now()) {
        user.token = v4()
        user.expire = Date.now() + config.authTokenExpire
        await ctx.database.setUser('name', name, pick(user, ['token', 'expire']))
      }
      setAuthUser(this, omit(user, ['password']))
    })

    ctx.console.addListener('login/token', async function (id, token) {
      const user = await ctx.database.getUser('id', id, authFields)
      if (!user) throw new Error('用户不存在。')
      if (user.token !== token || user.expire <= Date.now()) throw new Error('令牌已失效。')
      setAuthUser(this, user)
    })

    ctx.console.addListener('login/platform', async function (platform, userId) {
      const user = await ctx.database.getUser(platform, userId, ['name'])
      if (!user) throw new Error('找不到此账户。')
      const id = `${platform}:${userId}`
      const token = v4()
      const expire = Date.now() + config.loginTokenExpire
      states[id] = [token, expire, this]

      const listener = () => {
        delete states[id]
        dispose()
        this.socket.off('close', listener)
      }
      const dispose = ctx.setTimeout(() => {
        if (states[id]?.[1] >= Date.now()) listener()
      }, config.loginTokenExpire)
      this.socket.on('close', listener)

      return { id: user.id, name: user.name, token, expire }
    })

    ctx.any().private().middleware(async (session, next) => {
      const state = states[session.uid]
      if (state && state[0] === session.content) {
        const user = await session.observeUser(authFields)
        if (!user.expire || user.expire < Date.now()) {
          user.token = v4()
          user.expire = Date.now() + config.authTokenExpire
          await user.$update()
        }
        return setAuthUser(state[2], user)
      }
      return next()
    }, true)

    ctx.on('console/intercept', (handle, listener) => {
      if (!listener.authority) return false
      if (!handle.user) return true
      if (handle.user.expire <= Date.now()) return true
      return handle.user.authority < listener.authority
    })

    ctx.console.addListener('user/logout', async function () {
      setAuthUser(this, null)
    })

    ctx.console.addListener('user/update', async function (data) {
      if (!this.user) throw new Error('请先登录。')
      await ctx.database.setUser('id', this.user.id, data)
    })
  }
}

namespace AuthService {
  export interface Config {
    authTokenExpire?: number
    loginTokenExpire?: number
  }

  export const Config: Schema<Config> = Schema.object({
    authTokenExpire: Schema.natural().role('ms').default(Time.week).description('用户令牌有效期。'),
    loginTokenExpire: Schema.natural().role('ms').default(Time.minute * 10).description('登录令牌有效期。'),
  })
}

export default AuthService
