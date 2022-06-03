import { Adapter, Bot, camelize, Dict, Logger, noop, Quester, Schema, segment } from 'koishi'
import * as OneBot from './utils'

export function renderText(source: string) {
  return segment.parse(source).reduce((prev, { type, data }) => {
    if (type === 'at') {
      if (data.type === 'all') return prev + '[CQ:at,qq=all]'
      return prev + `[CQ:at,qq=${data.id}]`
    } else if (['video', 'audio', 'image'].includes(type)) {
      if (type === 'audio') type = 'record'
      data.file = data.url
      delete data.url
    } else if (type === 'quote') {
      type = 'reply'
    }
    return prev + segment(type, data)
  }, '')
}

export interface BotConfig extends Bot.BaseConfig, Quester.Config {
  selfId?: string
  token?: string
  qqguildPlatform?: string
}

export const BotConfig: Schema<BotConfig> = Schema.intersect([
  Schema.object({
    selfId: Schema.string(),
    token: Schema.string().role('secret'),
    qqguildPlatform: Schema.string().default('qqguild'),
  }),
  Quester.Config,
])

export class OneBotBot extends Bot<BotConfig> {
  static schema = OneBot.AdapterConfig

  public internal = new Internal()
  public guildBot: QQGuildBot

  constructor(adapter: Adapter, config: BotConfig) {
    super(adapter, config)
    this.selfId = config.selfId
    this.avatar = `http://q.qlogo.cn/headimg_dl?dst_uin=${config.selfId}&spec=640`
  }

  get status() {
    return super.status
  }

  set status(status) {
    super.status = status
    if (this.guildBot && this.app.bots.includes(this.guildBot)) {
      this.app.emit('bot-status-updated', this.guildBot)
    }
  }

  async stop() {
    if (this.guildBot) {
      // QQGuild stub bot should also be removed
      this.app.bots.remove(this.guildBot.sid)
    }
    await super.stop()
  }

  async initialize() {
    await Promise.all([
      this.getSelf().then(data => Object.assign(this, data)),
      this.setupGuildService().catch(noop),
    ]).then(() => this.resolve(), error => this.reject(error))
  }

  async setupGuildService() {
    const profile = await this.internal.getGuildServiceProfile()
    // guild service is not supported in this account
    if (!profile?.tiny_id || profile.tiny_id === '0') return
    const guildBotConfig: BotConfig = {
      ...this.config,
      platform: this.config.qqguildPlatform,
      selfId: profile.tiny_id,
    }
    this.guildBot = this.app.bots.create('onebot', guildBotConfig, QQGuildBot)
    this.guildBot.hidden = true
    this.guildBot.internal = this.internal
    this.guildBot.parentBot = this
    this.guildBot.avatar = profile.avatar_url
    this.guildBot.username = profile.nickname
  }

  sendMessage(channelId: string, content: string, guildId?: string) {
    content = renderText(content)
    return channelId.startsWith('private:')
      ? this.sendPrivateMessage(channelId.slice(8), content)
      : this.sendGuildMessage(guildId, channelId, content)
  }

  async getMessage(channelId: string, messageId: string) {
    const data = await this.internal.getMsg(messageId)
    return OneBot.adaptMessage(data)
  }

  async deleteMessage(channelId: string, messageId: string) {
    await this.internal.deleteMsg(messageId)
  }

  async getSelf() {
    const data = await this.internal.getLoginInfo()
    return OneBot.adaptUser(data)
  }

  async getUser(userId: string) {
    const data = await this.internal.getStrangerInfo(userId)
    return OneBot.adaptUser(data)
  }

  async getFriendList() {
    const data = await this.internal.getFriendList()
    return data.map(OneBot.adaptUser)
  }

  async getChannel(channelId: string) {
    const data = await this.internal.getGroupInfo(channelId)
    return OneBot.adaptChannel(data)
  }

  async getGuild(guildId: string) {
    const data = await this.internal.getGroupInfo(guildId)
    return OneBot.adaptGuild(data)
  }

  async getGuildList() {
    const data = await this.internal.getGroupList()
    return data.map(OneBot.adaptGuild)
  }

  async getGuildMember(guildId: string, userId: string) {
    const data = await this.internal.getGroupMemberInfo(guildId, userId)
    return OneBot.adaptGuildMember(data)
  }

  async getGuildMemberList(guildId: string) {
    const data = await this.internal.getGroupMemberList(guildId)
    return data.map(OneBot.adaptGuildMember)
  }

  async kickGuildMember(guildId: string, userId: string, permanent?: boolean) {
    return this.internal.setGroupKick(guildId, userId, permanent)
  }

  async muteGuildMember(guildId: string, userId: string, duration: number) {
    return this.internal.setGroupBan(guildId, userId, duration / 1000)
  }

  async muteChannel(channelId: string, guildId?: string, enable?: boolean) {
    return this.internal.setGroupWholeBan(channelId, enable)
  }

  protected async sendGuildMessage(guildId: string, channelId: string, content: string) {
    const session = await this.session({ content, subtype: 'group', guildId, channelId })
    if (!session?.content) return []
    session.messageId = '' + await this.internal.sendGroupMsg(channelId, session.content)
    this.app.emit(session, 'send', session)
    return [session.messageId]
  }

  async sendPrivateMessage(userId: string, content: string) {
    const session = await this.session({ content, subtype: 'private', userId, channelId: 'private:' + userId })
    if (!session?.content) return []
    session.messageId = '' + await this.internal.sendPrivateMsg(userId, session.content)
    this.app.emit(session, 'send', session)
    return [session.messageId]
  }

  async handleFriendRequest(messageId: string, approve: boolean, comment?: string) {
    await this.internal.setFriendAddRequest(messageId, approve, comment)
  }

  async handleGuildRequest(messageId: string, approve: boolean, comment?: string) {
    await this.internal.setGroupAddRequest(messageId, 'invite', approve, comment)
  }

  async handleGuildMemberRequest(messageId: string, approve: boolean, comment?: string) {
    await this.internal.setGroupAddRequest(messageId, 'add', approve, comment)
  }

  async deleteFriend(userId: string) {
    await this.internal.deleteFriend(userId)
  }

  async getChannelMessageHistory(channelId: string, before?: string) {
    // include `before` message
    let list: OneBot.Message[]
    if (before) {
      const msg = await this.internal.getMsg(before)
      if (msg?.message_seq) {
        list = (await this.internal.getGroupMsgHistory(Number(channelId), msg.message_seq)).messages
      }
    } else {
      list = (await this.internal.getGroupMsgHistory(Number(channelId))).messages
    }

    // 从旧到新
    return list.map(OneBot.adaptMessage)
  }
}

export class QQGuildBot extends OneBotBot {
  parentBot: OneBotBot

  get status() {
    if (!this.parentBot) {
      return 'offline'
    }
    return this.parentBot.status
  }

  set status(status) {
    // cannot change status here
  }

  async start() {
    await this.app.parallel('bot-connect', this)
  }

  async stop() {
    // Don't stop this bot twice
    if (!this.parentBot) return
    // prevent circular reference and use this as already disposed
    this.parentBot = undefined
    await this.app.parallel('bot-disconnect', this)
  }

  async sendGuildMessage(guildId: string, channelId: string, content: string) {
    const session = await this.session({ content, subtype: 'group', guildId, channelId })
    if (!session?.content) return []
    session.messageId = '' + await this.internal.sendGuildChannelMsg(guildId, channelId, session.content)
    this.app.emit(session, 'send', session)
    return [session.messageId]
  }

  async getChannel(channelId: string, guildId?: string) {
    const channels = await this.getChannelList(guildId)
    return channels.find((channel) => channel.channelId === channelId)
  }

  async getChannelList(guildId: string) {
    const data = await this.internal.getGuildChannelList(guildId, false)
    return (data || []).map(OneBot.adaptChannel)
  }

  async getGuild(guildId: string) {
    const data = await this.internal.getGuildMetaByGuest(guildId)
    return OneBot.adaptGuild(data)
  }

  async getGuildList() {
    const data = await this.internal.getGuildList()
    return data.map(OneBot.adaptGuild)
  }

  async getGuildMember(guildId: string, userId: string) {
    const profile = await this.internal.getGuildMemberProfile(guildId, userId)
    return OneBot.adaptQQGuildMemberProfile(profile)
  }

  async getGuildMemberList(guildId: string) {
    let nextToken: string | undefined
    let list: Bot.GuildMember[] = []
    while (true) {
      const data = await this.internal.getGuildMemberList(guildId, nextToken)
      if (!data.members?.length) break
      list = list.concat(data.members.map(OneBot.adaptQQGuildMemberInfo))
      if (data.finished) break
      nextToken = data.next_token
    }
    return list
  }
}

class SenderError extends Error {
  constructor(args: Dict, url: string, retcode: number) {
    super(`Error when trying to send to ${url}, args: ${JSON.stringify(args)}, retcode: ${retcode}`)
    Object.defineProperties(this, {
      name: { value: 'SenderError' },
      code: { value: retcode },
      args: { value: args },
      url: { value: url },
    })
  }
}

const logger = new Logger('onebot')

export interface Internal extends OneBot.Internal {}

export class Internal {
  _request?(action: string, params: Dict): Promise<OneBot.Response>

  private async _get<T = any>(action: string, params = {}): Promise<T> {
    logger.debug('[request] %s %o', action, params)
    const response = await this._request(action, params)
    logger.debug('[response] %o', response)
    const { data, retcode } = response
    if (retcode === 0) return data
    throw new SenderError(params, action, retcode)
  }

  async setGroupAnonymousBan(group_id: string, meta: string | object, duration?: number) {
    const args = { group_id, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anonymous'] = meta
    await this._get('set_group_anonymous_ban', args)
  }

  async setGroupAnonymousBanAsync(group_id: string, meta: string | object, duration?: number) {
    const args = { group_id, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anonymous'] = meta
    await this._get('set_group_anonymous_ban_async', args)
  }

  private static asyncPrefixes = ['set', 'send', 'delete', 'create', 'upload']

  private static prepareMethod(name: string) {
    const prop = camelize(name.replace(/^[_.]/, ''))
    const isAsync = Internal.asyncPrefixes.some(prefix => prop.startsWith(prefix))
    return [prop, isAsync] as const
  }

  static define(name: string, ...params: string[]) {
    const [prop, isAsync] = Internal.prepareMethod(name)
    Internal.prototype[prop] = async function (this: Internal, ...args: any[]) {
      const data = await this._get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
      if (!isAsync) return data
    }
    isAsync && (Internal.prototype[prop + 'Async'] = async function (this: Internal, ...args: any[]) {
      await this._get(name + '_async', Object.fromEntries(params.map((name, index) => [name, args[index]])))
    })
  }

  static defineExtract(name: string, key: string, ...params: string[]) {
    const [prop, isAsync] = Internal.prepareMethod(name)
    Internal.prototype[prop] = async function (this: Internal, ...args: any[]) {
      const data = await this._get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
      return data[key]
    }
    isAsync && (Internal.prototype[prop + 'Async'] = async function (this: Internal, ...args: any[]) {
      await this._get(name + '_async', Object.fromEntries(params.map((name, index) => [name, args[index]])))
    })
  }
}

Internal.defineExtract('send_private_msg', 'message_id', 'user_id', 'message', 'auto_escape')
Internal.defineExtract('send_group_msg', 'message_id', 'group_id', 'message', 'auto_escape')
Internal.defineExtract('send_group_forward_msg', 'message_id', 'group_id', 'messages')
Internal.define('delete_msg', 'message_id')
Internal.define('set_essence_msg', 'message_id')
Internal.define('delete_essence_msg', 'message_id')
Internal.define('send_like', 'user_id', 'times')
Internal.define('get_msg', 'message_id')
Internal.define('get_essence_msg_list', 'group_id')
Internal.define('ocr_image', 'image')
Internal.defineExtract('get_forward_msg', 'messages', 'message_id')
Internal.defineExtract('.get_word_slices', 'slices', 'content')
Internal.define('get_group_msg_history', 'group_id', 'message_seq')
Internal.define('set_friend_add_request', 'flag', 'approve', 'remark')
Internal.define('set_group_add_request', 'flag', 'sub_type', 'approve', 'reason')
Internal.defineExtract('_get_model_show', 'variants', 'model')
Internal.define('_set_model_show', 'model', 'model_show')

Internal.define('set_group_kick', 'group_id', 'user_id', 'reject_add_request')
Internal.define('set_group_ban', 'group_id', 'user_id', 'duration')
Internal.define('set_group_whole_ban', 'group_id', 'enable')
Internal.define('set_group_admin', 'group_id', 'user_id', 'enable')
Internal.define('set_group_anonymous', 'group_id', 'enable')
Internal.define('set_group_card', 'group_id', 'user_id', 'card')
Internal.define('set_group_leave', 'group_id', 'is_dismiss')
Internal.define('set_group_special_title', 'group_id', 'user_id', 'special_title', 'duration')
Internal.define('set_group_name', 'group_id', 'group_name')
Internal.define('set_group_portrait', 'group_id', 'file', 'cache')
Internal.define('_send_group_notice', 'group_id', 'content')
Internal.define('get_group_at_all_remain', 'group_id')

Internal.define('get_login_info')
Internal.define('get_stranger_info', 'user_id', 'no_cache')
Internal.define('_get_vip_info', 'user_id')
Internal.define('get_friend_list')
Internal.define('get_group_info', 'group_id', 'no_cache')
Internal.define('get_group_list')
Internal.define('get_group_member_info', 'group_id', 'user_id', 'no_cache')
Internal.define('get_group_member_list', 'group_id')
Internal.define('get_group_honor_info', 'group_id', 'type')
Internal.define('get_group_system_msg')
Internal.define('get_group_file_system_info', 'group_id')
Internal.define('get_group_root_files', 'group_id')
Internal.define('get_group_files_by_folder', 'group_id', 'folder_id')
Internal.define('upload_group_file', 'group_id', 'file', 'name', 'folder')
Internal.define('create_group_file_folder', 'group_id', 'folder_id', 'name')
Internal.define('delete_group_folder', 'group_id', 'folder_id')
Internal.define('delete_group_file', 'group_id', 'folder_id', 'file_id', 'busid')
Internal.defineExtract('get_group_file_url', 'url', 'group_id', 'file_id', 'busid')
Internal.defineExtract('download_file', 'file', 'url', 'headers', 'thread_count')
Internal.defineExtract('get_online_clients', 'clients', 'no_cache')
Internal.defineExtract('check_url_safely', 'level', 'url')
Internal.define('delete_friend', 'user_id')

Internal.defineExtract('get_cookies', 'cookies', 'domain')
Internal.defineExtract('get_csrf_token', 'token')
Internal.define('get_credentials', 'domain')
Internal.define('get_record', 'file', 'out_format', 'full_path')
Internal.define('get_image', 'file')
Internal.defineExtract('can_send_image', 'yes')
Internal.defineExtract('can_send_record', 'yes')
Internal.define('get_status')
Internal.define('get_version_info')
Internal.define('set_restart', 'delay')
Internal.define('reload_event_filter')

Internal.define('get_guild_service_profile')
Internal.define('get_guild_list')
Internal.define('get_guild_meta_by_guest', 'guild_id')
Internal.define('get_guild_channel_list', 'guild_id', 'no_cache')
Internal.define('get_guild_member_list', 'guild_id', 'next_token')
Internal.define('get_guild_member_profile', 'guild_id', 'user_id')
Internal.defineExtract('send_guild_channel_msg', 'message_id', 'guild_id', 'channel_id', 'message')
