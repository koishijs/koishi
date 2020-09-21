/* eslint-disable camelcase */

import { Webhooks } from '@octokit/webhooks'
import { EventConfig } from './events'
import axios, { AxiosError } from 'axios'
import { Session, User } from 'koishi-core'
import { Logger } from 'koishi-utils'

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
  replyPrefix?: string
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

interface PostOptions {
  url: string
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

  async _request(options: PostOptions) {
    const { url, session, body, headers } = options
    logger.debug('POST', url, body)
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

  async post(options: PostOptions) {
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
