import { Bot, Random, segment } from 'koishi-core'
import * as mineflayer from 'mineflayer'

const noop = async () => null

export class MinecraftBot extends Bot<'minecraft'> {
  version = 'minecraft'
  flayer: mineflayer.Bot

  async sendMessage(channelId: string, content: string, groupId?: string) {
    const session = this.createSession({ channelId, content, groupId, subtype: groupId ? 'group' : 'private' })
    if (await this.app.serial(session, 'before-send', session)) return
    const image = { type: 'text', data: { content: '[Image]' } }
    content = segment.join(segment.parse(content).map(i => i.type === 'image' ? image : i))
    if (content.length > 512) content = content.substr(0, 512) + '...'
    if (channelId === '_public') this.flayer.chat(content)
    else this.flayer.whisper(channelId, content)

    this.app.emit(session, 'send', session)
    return Random.uuid()
  }

  async sendPrivateMessage(channelId: string, content: string) {
    return this.sendMessage(channelId, content)
  }

  handleFriendRequest = noop
  handleGroupMemberRequest = noop
  handleGroupRequest = noop
  editMessage = noop
  deleteMessage = noop
  deleteFriend = noop
  getMessage = noop
  getUser = noop
  getChannel = noop
  getGroupMember = noop
  getGroup = noop

  async getGroupMemberList() {
    return []
  }

  async getGroupList() {
    return []
  }

  async getChannelList() {
    return []
  }
}
