/* eslint-disable camelcase */

import { Context, User } from 'koishi-core'
import { Logger, Time } from 'koishi-utils'
import { Webhooks } from '@octokit/webhooks'
import { Agent } from 'http'
import { encode } from 'querystring'
import axios from 'axios'
import events from './events'

declare module 'koishi-core/dist/app' {
  interface App {
    githubWebhooks?: Webhooks
  }
}

declare module 'koishi-core/dist/database' {
  interface User {
    githubToken?: string
  }
}

User.extend(() => ({
  githubToken: '',
}))

const logger = new Logger('github')

interface AuthorizeResult {
  access_token: string
  token_type: string
  scope: string
}

export interface Config {
  agent?: Agent
  secret?: string
  webhook?: string
  authorize?: string
  appId?: string
  appSecret?: string
  redirect?: string
  promptTimeout?: number
  replyTimeout?: number
  requestTimeout?: number
  repos?: Record<string, number[]>
}

const defaultOptions: Config = {
  secret: '',
  webhook: '/github/webhook',
  authorize: '/github/authorize',
  replyTimeout: Time.hour,
  repos: {},
}

export const name = 'github'

export function apply(ctx: Context, config: Config = {}) {
  if (!ctx.router) throw new Error('ctx.router is not defined')

  config = { ...defaultOptions, ...config }
  ctx.plugin(events, config)

  const { database } = ctx

  ctx.router.get(config.authorize, async (ctx) => {
    const targetId = parseInt(ctx.query.state)
    if (Number.isNaN(targetId)) throw new Error('Invalid targetId')
    const { code, state } = ctx.query
    const { data } = await axios.post<AuthorizeResult>('https://github.com/login/oauth/access_token', {
      client_id: config.appId,
      client_secret: config.appSecret,
      redirect_uri: config.redirect,
      code,
      state,
    }, {
      httpsAgent: config.agent,
      headers: { Accept: 'application/json' },
    })
    if (data.access_token) {
      await database.setUser(targetId, { githubToken: data.access_token })
      return ctx.status = 200
    } else {
      logger.warn(data)
      return ctx.status = 500
    }
  })

  ctx.command('github <user>', '授权 GitHub 功能')
    .action(async ({ session }, user) => {
      if (!user) return '请输入用户名。'
      const url = 'https://github.com/login/oauth/authorize?' + encode({
        client_id: config.appId,
        state: session.userId,
        redirect_uri: config.redirect,
        scope: 'admin:repo_hook,repo',
        login: user,
      })
      return '请点击下面的链接继续操作：\n' + url
    })
}
