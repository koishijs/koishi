/* eslint-disable camelcase */

import { EventConfig } from './events'
import axios, { AxiosError, Method } from 'axios'
import { App, Session, Tables, segment, Logger, Dict } from 'koishi'
import {} from '@koishijs/plugin-puppeteer'

declare module 'koishi' {
  interface App {
    github?: GitHub
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

Tables.extend('user', {
  ghAccessToken: 'string(50)',
  ghRefreshToken: 'string(50)',
})

Tables.extend('channel', {
  githubWebhooks: 'json',
})

Tables.extend('github', {
  id: 'integer',
  name: 'string(50)',
  secret: 'string(50)',
}, {
  primary: 'name',
})

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

export class GitHub {
  constructor(public app: App, public config: Config) {}

  async getTokens(params: any) {
    const { data } = await axios.post<OAuth>('https://github.com/login/oauth/access_token', {
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      ...params,
    }, {
      ...this.app.options.axiosConfig,
      headers: { Accept: 'application/json' },
    })
    return data
  }

  private async _request(method: Method, url: string, session: ReplySession, data?: any, headers?: Dict) {
    logger.debug(method, url, data)
    const response = await axios(url, {
      ...this.app.options.axiosConfig,
      data,
      method,
      timeout: this.config.requestTimeout,
      headers: {
        accept: 'application/vnd.github.v3+json',
        authorization: `token ${session.user.ghAccessToken}`,
        ...headers,
      },
    })
    return response.data
  }

  async authorize(session: Session, message: string) {
    await session.send(message)
    const name = await session.prompt(this.config.promptTimeout)
    if (!name) return session.send('输入超时。')
    await session.execute({ name: 'github.authorize', args: [name] })
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
    source = await this.session.app.transformAssets(source)
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
