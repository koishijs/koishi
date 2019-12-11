import { Context, CommandConfig } from 'koishi-core'
import admin from './admin'
import authorize from './authorize'
import broadcast, { BroadcastOptions } from './broadcast'
import callme, { CallmeOptions } from './callme'
import contextify from './contextify'
import echo from './echo'
import exit from './exit'
import help from './help'
import info from './info'
import likeme, { LikemeOptions } from './likeme'
import rank from './rank'
import repeater, { RepeaterOptions } from './repeater'
import requestHandler, { HandlerOptions } from './requestHandler'
import respondent, { Respondent } from './respondent'
import welcome, { WelcomeMessage } from './welcome'

export * from './admin'
export * from './exit'
export * from './info'
export * from './rank'

export {
  admin,
  authorize,
  broadcast,
  callme,
  contextify,
  echo,
  exit,
  help,
  info,
  likeme,
  rank,
  repeater,
  requestHandler,
  respondent,
  welcome,
}

interface CommonPluginOptions extends HandlerOptions {
  admin?: false | CommandConfig
  authorize?: false | Record<number, number>
  broadcast?: false | BroadcastOptions
  callme?: false | CallmeOptions
  contextify?: false | CommandConfig
  echo?: false | CommandConfig
  exit?: false | CommandConfig
  help?: false | CommandConfig
  info?: false | CommandConfig
  likeme?: false | LikemeOptions
  rank?: false | CommandConfig
  repeater?: false | RepeaterOptions
  respondent?: false | Respondent[]
  welcome?: false | WelcomeMessage
}

export const name = 'common'

export function apply (ctx: Context, options: CommonPluginOptions = {}) {
  ctx
    .plugin(admin, options.admin)
    .plugin(authorize, options.authorize)
    .plugin(broadcast, options.broadcast)
    .plugin(callme, options.callme)
    .plugin(contextify, options.contextify)
    .plugin(echo, options.echo)
    .plugin(exit, options.exit)
    .plugin(help, options.help)
    .plugin(info, options.info)
    .plugin(likeme, options.likeme)
    .plugin(rank, options.rank)
    .plugin(repeater, options.repeater)
    .plugin(requestHandler, options)
    .plugin(respondent, options.respondent)
    .plugin(welcome, options.welcome)
}
