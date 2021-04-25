/* eslint-disable camelcase */

export enum Signal { event, hello, ping, pong, reconnect, resume }

export interface Payload {
  s: Signal
  sn?: number
  d: Data
}

export enum Type {
  text = 1,
  image = 2,
  video = 3,
  file = 4,
  unknown = 7,
  audio = 8,
  kmarkdown = 9,
  card = 10,
  system = 255,
}

export interface MessageParams {
  type: Type
  msgId: string
  chatCode: string
  targetId: string
  content: any
  quote: string
  nonce: string
}

export interface MessageBase {
  type: Type
  content: string
}

export interface Data extends MessageBase {
  channelType: 'GROUP' | 'PERSON' | 'WEBHOOK_CHALLENGE'
  challenge: string
  verifyToken: string
  targetId: string
  authorId: string
  msgId: string
  msgTimestamp: number
  nonce: string
  extra: MessageExtra | Notice
}

type AttachmentType = 'image' | 'video' | 'audio' | 'file'
type NoticeType =
  | 'message_btn_click'
  | 'add_reaction' | 'deleted_reaction'
  | 'updated_message' | 'deleted_message'
  | 'joined_guild' | 'exited_guild'
  | 'updated_guild_member'
  | 'added_channel' | 'updated_channel' | 'deleted_channel'
  | 'updated_private_message' | 'deleted_private_message'
  | 'private_added_reaction' | 'private_deleted_reaction'
  | 'joined_channel' | 'exited_channel'
  | 'guild_member_online' | 'guild_member_offline'

export interface MessageMeta {
  mention: string[]
  mentionAll: boolean
  mentionRoles: string[]
  mentionHere: boolean
  attachments: Attachment
  quote: Message
  author: Author
}

export interface MessageExtra extends MessageMeta {
  type: Type
  code: string
  guildId: string
  channelName: string
}

export interface Message extends MessageBase, MessageMeta {
  id: string
  embeds: any[]
  reactions: any[]
  mentionInfo: object
}

export interface User {
  id: string
  username: string
  identifyNum: string
  avatar: string
  online: boolean
  bot?: boolean
}

export enum UserStatus { normal = 0, banned = 10 }

export interface Self extends User {
  status: UserStatus
  mobileVerified: boolean
  system: boolean
  mobilePrefix: string
  mobile: string
  invitedCount: number
}

export interface Author extends User {
  roles: number[]
  nickname?: string
}

export interface Attachment {
  type: AttachmentType
  name: string
  url: string
  fileType: string
  size: number
  duration: number
  width: number
  height: number
}

export interface Notice {
  type: NoticeType
  body: NoticeBody
}

export interface Channel {
  id: string
  name: string
  userId: string
  guildId: string
  isCategory: number
  parentId: string
  topic: string
  type: number
  level: number
  slowMode: number
  permissionOverwrites: Overwrite
  permissionUsers: any
  permissionSync: 0 | 1
}

export interface NoticeBody extends Channel, MessageMeta {
  value: string
  msgId: string
  targetId: string
  channelId: string
  emoji: Emoji
  content: string
  icon: string
  notifyType: number
  region: string
  enableOpen: number
  openId: number
  defaultChannelId: string
  welcomeChannelId: string
  updatedAt: number
  joinedAt: number
  exitedAt: number
  deletedAt: number
  nickname: string
  chatCode: string
  eventTime: number
  guilds: string[]
}

export interface Emoji {
  id: string
  name: string
}

export interface Overwrite {
  roleId: number
  allow: number
  deny: number
}

export interface ListMeta {
  page: number
  pageTotal: number
  pageSize: number
  total: number
}

export interface List<T> {
  items: T[]
  meta: ListMeta
  sort: Partial<Record<keyof T, number>>
}

export interface Guild {
  id: string
  name: string
  topic: string
  masterId: string
  isMaster: boolean
  icon: string
  inviteEnabled: number
  notifyType: number
  region: string
  enableOpen: number
  openId: string
  defaultChannelId: string
  welcomeChannelId: string
}

export interface GuildList extends List<Guild> {}

export interface GuildMember extends User {
  joinedAt: number
  activeTime: number
  roles: number[]
  isMaster: boolean
  abbr: string
}

export interface GuildMemberList extends List<GuildMember> {
  userCount: number
  onlineCount: number
  offlineCount: number
}
