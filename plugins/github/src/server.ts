import { EventConfig } from './events'
import axios, { AxiosError, Method } from 'axios'
import { Context, Dict, Logger, Quester, Schema, segment, Service, Session, Time } from 'koishi'
import {} from '@koishijs/plugin-puppeteer'

declare module 'koishi' {
  interface App {
    github?: GitHub
  }

  namespace Context {
    interface Services {
      github?: GitHub
    }
  }

  interface User {
    ghAccessToken: string
    ghRefreshToken: string
  }

  interface Channel {
    githubWebhooks: Dict<EventConfig>
  }

  interface Tables {
    github: Repository
  }
}

interface Repository {
  name: string
  secret: string
  id: number
}

export interface Config {
  path?: string
  appId?: string
  appSecret?: string
  messagePrefix?: string
  redirect?: string
  promptTimeout?: number
  replyTimeout?: number
  requestTimeout?: number
}

export const Config = Schema.object({
  path: Schema.string().description('GitHub 服务的路径。').default('/github'),
  appId: Schema.string().description('GitHub OAuth App ID.'),
  appSecret: Schema.string().description('GitHub OAuth App Secret.'),
  redirect: Schema.string().description('授权成功后的跳转链接。'),
  messagePrefix: Schema.string().description('推送消息的前缀。').default('[GitHub] '),
  replyTimeout: Schema.natural().role('ms').description('等待用户回复消息进行快捷操作的时间。').default(Time.hour),
  promptTimeout: Schema.natural().role('ms').description('等待用户键入用户名的时间。缺省时会使用全局设置。'),
  requestTimeout: Schema.natural().role('ms').description('等待请求 GitHub 的时间，超时将提示操作失败。缺省时会使用全局设置。'),
})

export interface OAuth {
  access_token: string
  expires_in: string
  refresh_token: string
  refresh_token_expires_in: string
  token_type: string
  scope: string
}

export type ReplySession = Session<'ghAccessToken' | 'ghRefreshToken'>

const logger = new Logger('github')

export class GitHub extends Service {
  private http: Quester

  constructor(public ctx: Context, public config: Config) {
    super(ctx, 'github', true)

    this.http = ctx.http.extend({})

    ctx.model.extend('user', {
      ghAccessToken: 'string(50)',
      ghRefreshToken: 'string(50)',
    })

    ctx.model.extend('channel', {
      githubWebhooks: 'json',
    })

    ctx.model.extend('github', {
      id: 'integer',
      name: 'string(50)',
      secret: 'string(50)',
    }, {
      primary: 'name',
    })
  }

  async getTokens(params: any) {
    return this.http.post<OAuth>('https://github.com/login/oauth/access_token', {}, {
      params: {
        client_id: this.config.appId,
        client_secret: this.config.appSecret,
        ...params,
      },
      headers: { Accept: 'application/json' },
      timeout: this.config.requestTimeout,
    })
  }

  private async _request(method: Method, url: string, session: ReplySession, data?: any, headers?: Dict) {
    logger.debug(method, url, data)
    return this.http(method, url, {
      data,
      headers: {
        accept: 'application/vnd.github.v3+json',
        authorization: `token ${session.user.ghAccessToken}`,
        ...headers,
      },
      timeout: this.config.requestTimeout,
    })
  }

  async authorize(session: Session, message: string) {
    await session.send(message)
    const name = await session.prompt(this.config.promptTimeout)
    if (name) {
      await session.execute({ name: 'github.authorize', args: [name] })
    } else {
      await session.send('输入超时。')
    }
  }

  async request(method: Method, url: string, session: ReplySession, body?: any, headers?: Dict) {
    if (!session.user.ghAccessToken) {
      return this.authorize(session, '要使用此功能，请对机器人进行授权。输入你的 GitHub 用户名。')
    }

    try {
      return await this._request(method, url, session, body, headers)
    } catch (error) {
      const { response } = error as AxiosError
      if (response?.status !== 401) throw error
    }

    try {
      const data = await this.getTokens({
        refresh_token: session.user.ghRefreshToken,
        grant_type: 'refresh_token',
      })
      session.user.ghAccessToken = data.access_token
      session.user.ghRefreshToken = data.refresh_token
    } catch {
      return this.authorize(session, '令牌已失效，需要重新授权。输入你的 GitHub 用户名。')
    }

    return await this._request(method, url, session, body, headers)
  }
}

export type ReplyPayloads = {
  [K in keyof ReplyHandler]?: ReplyHandler[K] extends (...args: infer P) => any ? P : never
}

export type EventData<T = {}> = [string, (ReplyPayloads & T)?]

export class ReplyHandler {
  constructor(public github: GitHub, public session: ReplySession, public content?: string) {}

  async request(method: Method, url: string, message: string, body?: any, headers?: Dict) {
    try {
      await this.github.request(method, url, this.session, body, headers)
    } catch (err) {
      if (!axios.isAxiosError(err)) throw err
      logger.warn(err)
      return this.session.send(message)
    }
  }

  link(url: string) {
    return this.session.send(url)
  }

  react(url: string) {
    return this.request('POST', url, '发送失败。', {
      content: this.content,
    }, {
      accept: 'application/vnd.github.squirrel-girl-preview',
    })
  }

  async transform(source: string) {
    if (this.github.ctx.assets) {
      source = await this.github.ctx.assets.transform(source)
    }
    return segment.transform(source, {
      text: ({ content }) => content,
      image: ({ url }) => `![image](${url})`,
    }, true)
  }

  async reply(url: string, params?: Dict) {
    return this.request('POST', url, '发送失败。', {
      body: await this.transform(this.content),
      ...params,
    })
  }

  base(url: string) {
    return this.request('PATCH', url, '修改失败。', {
      base: this.content,
    })
  }

  merge(url: string, method?: 'merge' | 'squash' | 'rebase') {
    const [title] = this.content.split('\n', 1)
    const message = this.content.slice(title.length)
    return this.request('PUT', url, '操作失败。', {
      merge_method: method,
      commit_title: title.trim(),
      commit_message: message.trim(),
    })
  }

  rebase(url: string) {
    return this.merge(url, 'rebase')
  }

  squash(url: string) {
    return this.merge(url, 'squash')
  }

  async close(url: string, commentUrl: string) {
    if (this.content) await this.reply(commentUrl)
    await this.request('PATCH', url, '操作失败。', {
      state: 'closed',
    })
  }

  async shot(url: string, selector: string, padding: number[] = []) {
    const page = await this.session.app.puppeteer.page()
    let buffer: Buffer
    try {
      await page.goto(url)
      const el = await page.$(selector)
      const clip = await el.boundingBox()
      const [top = 0, right = 0, bottom = 0, left = 0] = padding
      clip.x -= left
      clip.y -= top
      clip.width += left + right
      clip.height += top + bottom
      buffer = await page.screenshot({ clip })
    } catch (error) {
      new Logger('puppeteer').warn(error)
      return this.session.send('截图失败。')
    } finally {
      await page.close()
    }
    return this.session.send(segment.image(buffer))
  }
}
