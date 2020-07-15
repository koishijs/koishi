import { Context } from 'koishi-core'
import admin from './admin'
import broadcast from './broadcast'
import contextify from './contextify'
import echo from './echo'
import info from './info'
import repeater, { RepeaterOptions } from './repeater'
import requestHandler, { HandlerOptions } from './request-handler'
import respondent, { Respondent } from './respondent'
import usage from './usage'
import welcome, { WelcomeMessage } from './welcome'

export * from './admin'
export * from './broadcast'
export * from './info'
export * from './repeater'

export {
  HandlerOptions,
  RepeaterOptions,
  Respondent,
  WelcomeMessage,
}

export interface Config extends HandlerOptions {
  admin?: boolean
  broadcast?: boolean
  contextify?: boolean
  echo?: boolean
  exec?: boolean
  exit?: boolean
  help?: boolean
  info?: boolean
  repeater?: RepeaterOptions
  respondent?: Respondent[]
  usage?: boolean
  welcomeMessage?: WelcomeMessage
}

export const name = 'common'

export function apply (ctx: Context, options: Config = {}) {
  ctx.plugin(requestHandler, options)
  ctx.plugin(repeater, options.repeater)
  ctx.plugin(respondent, options.respondent)
  ctx.plugin(welcome, options.welcomeMessage)

  if (options.echo !== false) ctx.plugin(echo)

  if (ctx.database) {
    if (options.admin !== false) ctx.plugin(admin)
    if (options.contextify !== false) ctx.plugin(contextify)
    if (options.broadcast !== false) ctx.plugin(broadcast, options)
    if (options.info !== false) ctx.plugin(info, options)
    if (options.usage !== false) ctx.plugin(usage, options)
  }
}
