import { Guild as GGuild, User as GUser } from '@qq-guild-sdk/core/dist/common'
import { Bot } from 'koishi'

export const adaptGuild = (guild: GGuild): Bot.Guild => ({
  guildId: guild.id, guildName: guild.name,
})

export const adaptUser = (user: GUser): Bot.User => ({
  isBot: user.bot,
  avatar: user.avatar,
  userId: user.id,
  username: user.username,
  nickname: user.username,
})
