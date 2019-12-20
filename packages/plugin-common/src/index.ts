import { Context, CommandConfig } from 'koishi-core'
import admin from './admin'
import authorizeGroup, { AuthorizeGroupOptions } from './authorizeGroup'
import authorizeUser, { AuthorizeUserOptions } from './authorizeUser'
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
export * from './info'
export * from './rank'

export {
  admin,
  authorizeGroup,
  authorizeUser,
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
  authorizeGroup?: AuthorizeGroupOptions
  authorizeUser?: AuthorizeUserOptions
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
  respondent?: Respondent[]
  welcome?: false | WelcomeMessage
}

export const name = 'common'

export function apply (ctx: Context, options: CommonPluginOptions = {}) {
  ctx
    .plugin(contextify, options.contextify)
    .plugin(echo, options.echo)
    .plugin(exit, options.exit)
    .plugin(help, options.help)
    .plugin(likeme, options.likeme)
    .plugin(repeater, options.repeater)
    .plugin(requestHandler, options)
    .plugin(respondent, options.respondent)
    .plugin(welcome, options.welcome)

  if (ctx.database) {
    ctx
      .plugin(admin, options.admin)
      .plugin(authorizeUser, options.authorizeUser)
      .plugin(authorizeGroup, options.authorizeGroup)
      .plugin(broadcast, options.broadcast)
      .plugin(callme, options.callme)
      .plugin(info, options.info)
      .plugin(rank, options.rank)
  }
}
