/* eslint-disable camelcase */

import { EventConfig } from './events'
import axios, { AxiosError, Method } from 'axios'
import { App, Session, User } from 'koishi-core'
import { segment, Logger } from 'koishi-utils'
import {} from 'koishi-plugin-puppeteer'

declare module 'koishi-core/dist/database' {
  interface User {
    ghAccessToken?: string
    ghRefreshToken?: string
  }
}

User.extend(() => ({
  ghAccessToken: '',
  ghRefreshToken: '',
}))

export interface Config {
  secret?: string
  webhook?: string
  authorize?: string
  messagePrefix?: string
  appId?: string
  appSecret?: string
  redirect?: string
  promptTimeout?: number
  replyTimeout?: number
  requestTimeout?: number
  repos?: Record<string, string[]>
  events?: EventConfig
}

export interface OAuth {
  access_token: string
  expires_in: string
  refresh_token: string
  refresh_token_expires_in: string
  token_type: string
  scope: string
}

type ReplySession = Session<'ghAccessToken' | 'ghRefreshToken'>

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

  private async _request(url: string, method: Method, session: ReplySession, body: any, headers?: Record<string, any>) {
    logger.debug(method, url, body)
    await axios.post(url, body, {
      ...this.app.options.axiosConfig,
      timeout: this.config.requestTimeout,
      headers: {
        accept: 'application/vnd.github.v3+json',
        authorization: `token ${session.user.ghAccessToken}`,
        ...headers,
      },
    })
  }

  async authorize(session: Session, message: string) {
    await session.send(message)
    const name = await session.prompt(this.config.promptTimeout)
    if (!name) return session.send('输入超时。')
    return session.execute({ name: 'github.authorize', args: [name] })
  }

  async request(url: string, method: Method, session: ReplySession, body: any, headers?: Record<string, any>) {
    if (!session.user.ghAccessToken) {
      return this.authorize(session, '要使用此功能，请对机器人进行授权。输入你的 GitHub 用户名。')
    }

    try {
      return await this._request(url, method, session, body, headers)
    } catch (error) {
      const { response } = error as AxiosError
      if (response?.status !== 401) {
        logger.warn(error)
        return session.send('发送失败。')
      }
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

    try {
      await this._request(url, method, session, body, headers)
    } catch (error) {
      logger.warn(error)
      return session.send('发送失败。')
    }
  }
}

function formatReply(source: string) {
  return segment.parse(source).map((node) => {
    if (node.type === 'text') return node.data.content
    if (node.type === 'image') return `![image](${node.data.url})`
    return ''
  }).join('')
}

type ReplyPayloads = {
  [K in keyof ReplyHandler]?: ReplyHandler[K] extends (...args: infer P) => any ? P : never
}

export type EventData<T = {}> = [string, (ReplyPayloads & T)?]

export class ReplyHandler {
  constructor(public github: GitHub, public session: Session, public content?: string) {}

  link(url: string) {
    return this.session.send(url)
  }

  react(url: string) {
    return this.github.request(url, 'POST', this.session, {
      content: this.content,
    }, {
      accept: 'application/vnd.github.squirrel-girl-preview',
    })
  }

  reply(url: string, params?: Record<string, any>) {
    return this.github.request(url, 'POST', this.session, {
      body: formatReply(this.content),
      ...params,
    })
  }

  base(url: string) {
    return this.github.request(url, 'PATCH', this.session, {
      base: this.content,
    })
  }

  merge(url: string, method?: 'merge' | 'squash' | 'rebase') {
    const [title] = this.content.split('\n', 1)
    const message = this.content.slice(title.length)
    return this.github.request(url, 'PUT', this.session, {
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
    await this.github.request(url, 'PATCH', this.session, {
      state: 'closed',
    })
  }

  async shot(url: string, selector: string, padding: number[] = []) {
    const page = await this.session.app.browser.newPage()
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
    return this.session.send(`[CQ:image,file=base64://${buffer.toString('base64')}]`)
  }
}
