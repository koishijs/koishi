/* eslint-disable camelcase */

import { Webhooks } from '@octokit/webhooks'
import { EventConfig } from './events'
import axios, { AxiosError, Method } from 'axios'
import { Session, User } from 'koishi-core'
import { CQCode, Logger } from 'koishi-utils'

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
  repos?: Record<string, number[]>
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

interface RequestOptions {
  url: string
  method: Method
  session: ReplySession
  body: any
  headers?: Record<string, any>
}

type ReplySession = Session<'ghAccessToken' | 'ghRefreshToken'>

const logger = new Logger('github')

export class GitHub extends Webhooks {
  constructor(public config: Config) {
    super({ ...config, path: config.webhook })
  }

  async getTokens(params: any) {
    const { data } = await axios.post<OAuth>('https://github.com/login/oauth/access_token', {
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      ...params,
    }, {
      headers: { Accept: 'application/json' },
    })
    return data
  }

  private async _request(options: RequestOptions) {
    const { url, session, body, headers } = options
    logger.debug(options.method, url, body)
    await axios.post(url, body, {
      timeout: this.config.requestTimeout,
      headers: {
        accept: 'application/vnd.github.v3+json',
        authorization: `token ${session.$user.ghAccessToken}`,
        ...headers,
      },
    })
  }

  async authorize(session: Session, message: string) {
    await session.$send(message)
    const name = await session.$prompt(this.config.promptTimeout)
    if (!name) return session.$send('输入超时。')
    return session.$execute({ command: 'github.authorize', args: [name] })
  }

  async request(options: RequestOptions) {
    const { session } = options
    if (!session.$user.ghAccessToken) {
      return this.authorize(session, '要使用此功能，请对机器人进行授权。输入你的 GitHub 用户名。')
    }

    try {
      return await this._request(options)
    } catch (error) {
      const { response } = error as AxiosError
      if (response?.status !== 401) {
        logger.warn(error)
        return session.$send('发送失败。')
      }
    }

    try {
      const data = await this.getTokens({
        refresh_token: session.$user.ghRefreshToken,
        grant_type: 'refresh_token',
      })
      session.$user.ghAccessToken = data.access_token
      session.$user.ghRefreshToken = data.refresh_token
    } catch {
      return this.authorize(session, '令牌已失效，需要重新授权。输入你的 GitHub 用户名。')
    }

    try {
      await this._request(options)
    } catch (error) {
      logger.warn(error)
      return session.$send('发送失败。')
    }
  }
}

function formatReply(source: string) {
  return CQCode.parseAll(source).map((value) => {
    if (typeof value === 'string') return value
    if (value.type === 'image') return `![image](${value.data.url})`
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
    return this.session.$send(url)
  }

  react(url: string) {
    return this.github.request({
      url,
      method: 'POST',
      session: this.session,
      body: { content: this.content },
      headers: { accept: 'application/vnd.github.squirrel-girl-preview' },
    })
  }

  reply(url: string, params?: Record<string, any>) {
    return this.github.request({
      url,
      method: 'POST',
      session: this.session,
      body: { ...params, body: formatReply(this.content) },
    })
  }

  async close(url: string) {
    if (this.content) await this.reply(url)
    await this.github.request({
      url,
      method: 'PATCH',
      session: this.session,
      body: { state: 'closed' },
    })
  }

  async shot(url: string, selector: string, padding: number[] = []) {
    const page = await this.session.$app.browser.newPage()
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
      return this.session.$send('截图失败。')
    } finally {
      await page.close()
    }
    return this.session.$send(`[CQ:image,file=base64://${buffer.toString('base64')}]`)
  }
}
