import { sleep } from '@koishijs/utils'
import { defineProperty, Dict } from 'cosmokit'
import { Adapter, Bot, Fragment } from '@satorijs/core'

declare module '@satorijs/core' {
  interface Bot {
    /** @deprecated */
    getGuildMemberMap(guildId: string): Promise<Dict<string>>
    broadcast(channels: (string | [string, string] | Session)[], content: Fragment, delay?: number): Promise<string[]>
  }

  interface Events {
    'appellation'(name: string, session: Session): string
  }
}

// adapter plugins usually do not respect filters
defineProperty(Bot, 'filter', false)
defineProperty(Adapter, 'filter', false)

Bot.prototype.getGuildMemberMap = async function getGuildMemberMap(this: Bot, guildId) {
  const result: Dict<string> = {}
  for await (const member of this.getGuildMemberIter(guildId)) {
    result[member.user.id] = member.nickname || member.user.nick || member.user.name
  }
  return result
}

Bot.prototype.broadcast = async function broadcast(this: Bot, channels, content, delay = this.ctx.root.config.delay.broadcast) {
  const messageIds: string[] = []
  for (let index = 0; index < channels.length; index++) {
    if (index && delay) await sleep(delay)
    try {
      const value = channels[index]
      messageIds.push(...typeof value === 'string'
        ? await this.sendMessage(value, content)
        : Array.isArray(value)
          ? await this.sendMessage(value[0], content, value[1])
          : await this.sendMessage(value.channelId, content, value.guildId, { session: value }))
    } catch (error) {
      this.ctx.logger('bot').warn(error)
    }
  }
  return messageIds
}
