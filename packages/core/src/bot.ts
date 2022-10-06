import { Dict, makeArray, sleep } from '@koishijs/utils'
import { Context } from './context'
import { Session } from './session'
import * as satori from '@satorijs/core'

declare module '@satorijs/core' {
  interface Bot {
    getGuildMemberMap(guildId: string): Promise<Dict<string>>
    broadcast(channels: (string | [string, string])[], content: string | satori.segment, delay?: number): Promise<string[]>
  }
}

export type { Message } from '@satorijs/core'
export { Adapter, h, segment, Logger, Quester } from '@satorijs/core'

export type Filter = satori.Filter<Context>

export const Bot = satori.Bot<Context>
export type Bot = satori.Bot<Context>

export namespace Bot {
  export type Status = satori.Bot.Status
  export type Config = satori.Bot.Config
}

Bot.prototype.session = function session(this: Bot, payload) {
  return new Session(this, payload)
}

Bot.prototype.getGuildMemberMap = async function getGuildMemberMap(this: Bot, guildId) {
  const list = await this.getGuildMemberList(guildId)
  return Object.fromEntries(list.map(info => [info.userId, info.nickname || info.username]))
}

Bot.prototype.broadcast = async function broadcast(this: Bot, channels, content, delay = this.ctx.root.config.delay.broadcast) {
  const messageIds: string[] = []
  for (let index = 0; index < channels.length; index++) {
    if (index && delay) await sleep(delay)
    try {
      const [channelId, guildId] = makeArray(channels[index])
      messageIds.push(...await this.sendMessage(channelId, content, guildId))
    } catch (error) {
      this.ctx.logger('bot').warn(error)
    }
  }
  return messageIds
}
