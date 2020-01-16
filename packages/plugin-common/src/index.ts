import { Context, CommandConfig } from 'koishi-core'
import admin from './admin'
import authorize, { AuthorizeConfig } from './authorize'
import broadcast, { BroadcastOptions } from './broadcast'
import contextify from './contextify'
import echo from './echo'
import exit from './exit'
import help from './help'
import info, { InfoOptions } from './info'
import repeater, { RepeaterOptions } from './repeater'
import requestHandler, { HandlerConfig } from './request-handler'
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

interface CommonPluginConfig extends HandlerConfig, AuthorizeConfig {
  admin?: false | CommandConfig
  broadcast?: false | BroadcastOptions
  contextify?: false | CommandConfig
  echo?: false | CommandConfig
  exit?: false | CommandConfig
  help?: false | CommandConfig
  info?: false | InfoOptions
  repeater?: false | RepeaterOptions
  respondent?: Respondent[]
  welcome?: false | WelcomeMessage
}

export const name = 'common'

export function apply (ctx: Context, options: CommonPluginConfig = {}) {
  ctx
    .plugin(contextify, options.contextify)
    .plugin(echo, options.echo)
    .plugin(exit, options.exit)
    .plugin(help, options.help)
    .plugin(repeater, options.repeater)
    .plugin(requestHandler, options)
    .plugin(respondent, options.respondent)
    .plugin(welcome, options.welcome)

  if (ctx.database) {
    ctx
      .plugin(admin, options.admin)
      .plugin(authorize, options)
      .plugin(broadcast, options.broadcast)
      .plugin(info, options.info)
  }
}
