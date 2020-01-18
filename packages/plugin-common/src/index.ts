import { Context } from 'koishi-core'
import admin from './admin'
import authorize, { AuthorizeOptions } from './authorize'
import broadcast, { BroadcastOptions } from './broadcast'
import contextify from './contextify'
import echo from './echo'
import exit from './exit'
import help from './help'
import info, { InfoOptions } from './info'
import repeater, { RepeaterOptions } from './repeater'
import requestHandler, { HandlerOptions } from './request-handler'
import respondent, { Respondent } from './respondent'
import welcome, { WelcomeMessage } from './welcome'

export * from './admin'
export * from './info'

export {
  admin,
  authorize,
  broadcast,
  contextify,
  echo,
  exit,
  help,
  info,
  repeater,
  requestHandler,
  respondent,
  welcome,
}

interface CommonPluginConfig extends AuthorizeOptions, BroadcastOptions, HandlerOptions, InfoOptions {
  admin?: boolean
  broadcast?: boolean
  contextify?: boolean
  echo?: boolean
  exit?: boolean
  help?: boolean
  info?: boolean
  repeater?: RepeaterOptions
  respondent?: Respondent[]
  welcomeMessage?: WelcomeMessage
}

export const name = 'common'

export function apply (ctx: Context, options: CommonPluginConfig = {}) {
  ctx.plugin(requestHandler, options)
  ctx.plugin(respondent, options.respondent)
  ctx.plugin(welcome, options.welcomeMessage)

  if (options.contextify !== false) ctx.plugin(contextify)
  if (options.echo !== false) ctx.plugin(echo)
  if (options.exit !== false) ctx.plugin(exit)
  if (options.help !== false) ctx.plugin(help)
  if (options.repeater) ctx.plugin(repeater, options.repeater)

  if (ctx.database) {
    ctx.plugin(authorize, options)

    if (options.admin !== false) ctx.plugin(admin)
    if (options.broadcast !== false) ctx.plugin(broadcast, options)
    if (options.info !== false) ctx.plugin(info, options)
  }
}
