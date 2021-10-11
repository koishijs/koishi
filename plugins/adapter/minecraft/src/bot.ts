import { Bot, Random, Schema, segment } from 'koishi'
import * as mineflayer from 'mineflayer'
import { AdapterConfig } from './utils'

const noop = async () => null

export interface BotConfig extends Bot.BaseConfig, mineflayer.BotOptions {}

export const BotConfig: Schema<BotConfig> = Schema.object({
  username: Schema.string(),
})

export class MinecraftBot extends Bot<BotConfig> {
  flayer: mineflayer.Bot

  static schema = AdapterConfig

  async sendMessage(channelId: string, content: string, guildId?: string) {
    const session = this.createSession({ channelId, content, guildId, subtype: guildId ? 'group' : 'private' })
    if (await this.app.serial(session, 'before-send', session)) return
    const image = { type: 'text', data: { content: '[Image]' } }
    content = segment.join(segment.parse(content).map(i => i.type === 'image' ? image : i))
    if (content.length > 512) content = content.substr(0, 512) + '...'
    if (channelId === '_public') this.flayer.chat(content)
    else this.flayer.whisper(channelId, content)

    this.app.emit(session, 'send', session)
    return Random.id()
  }

  async sendPrivateMessage(channelId: string, content: string) {
    return this.sendMessage(channelId, content)
  }

  handleFriendRequest = noop
  handleGuildMemberRequest = noop
  handleGuildRequest = noop
  editMessage = noop
  deleteMessage = noop
  deleteFriend = noop
  getMessage = noop
  getUser = noop
  getChannel = noop
  getGuildMember = noop
  getGuild = noop

  async getGuildMemberList() {
    return []
  }

  async getGuildList() {
    return []
  }

  async getChannelList() {
    return []
  }
}
