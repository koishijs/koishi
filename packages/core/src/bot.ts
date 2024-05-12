import { sleep } from '@koishijs/utils'
import { defineProperty, Dict } from 'cosmokit'
import { Adapter, Bot, Fragment } from '@satorijs/core'
import { Context } from './context'
import { Session } from './session'

declare module '@satorijs/core' {
  interface Bot {
    /** @deprecated */
    getGuildMemberMap(guildId: string): Promise<Dict<string>>
    broadcast(channels: (string | [string, string] | Session)[], content: Fragment, delay?: number): Promise<string[]>
  }
}

// adapter plugins usually do not respect filters
defineProperty(Bot, 'filter', false)
defineProperty(Adapter, 'filter', false)

export interface KoishiBot extends Bot<Context> {}

export class KoishiBot {
  constructor(ctx: Context) {
    ctx.accessor('bot.getGuildMemberMap', { get: () => this.getGuildMemberMap })
    ctx.accessor('bot.broadcast', { get: () => this.broadcast })
    ctx.accessor('bot.session', { get: () => this.session })
  }

  async getGuildMemberMap(guildId: string) {
    const result: Dict<string> = {}
    for await (const member of this.getGuildMemberIter(guildId)) {
      result[member.user.id] = member.name || member.user.name
    }
    return result
  }

  async broadcast(channels: (string | [string, string] | Session)[], content: Fragment, delay = this.ctx.root.config.delay.broadcast) {
    const ids: string[] = []
    for (let index = 0; index < channels.length; index++) {
      if (index && delay) await sleep(delay)
      try {
        const value = channels[index]
        ids.push(...typeof value === 'string'
          ? await this.sendMessage(value, content)
          : Array.isArray(value)
            ? await this.sendMessage(value[0], content, value[1])
            : await this.sendMessage(value.channelId, content, value.guildId, { session: value }))
      } catch (error) {
        this.ctx.logger('bot').warn(error)
      }
    }
    return ids
  }

  session(event: Partial<Event> = {}) {
    return new Session(this, event)
  }
}
