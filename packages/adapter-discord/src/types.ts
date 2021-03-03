/* eslint-disable camelcase */

type WSEventType =
  | 'READY'
  | 'RESUMED'
  | 'GUILD_CREATE'
  | 'GUILD_DELETE'
  | 'GUILD_UPDATE'
  | 'INVITE_CREATE'
  | 'INVITE_DELETE'
  | 'GUILD_MEMBER_ADD'
  | 'GUILD_MEMBER_REMOVE'
  | 'GUILD_MEMBER_UPDATE'
  | 'GUILD_MEMBERS_CHUNK'
  | 'GUILD_ROLE_CREATE'
  | 'GUILD_ROLE_DELETE'
  | 'GUILD_ROLE_UPDATE'
  | 'GUILD_BAN_ADD'
  | 'GUILD_BAN_REMOVE'
  | 'GUILD_EMOJIS_UPDATE'
  | 'GUILD_INTEGRATIONS_UPDATE'
  | 'CHANNEL_CREATE'
  | 'CHANNEL_DELETE'
  | 'CHANNEL_UPDATE'
  | 'CHANNEL_PINS_UPDATE'
  | 'MESSAGE_CREATE'
  | 'MESSAGE_DELETE'
  | 'MESSAGE_UPDATE'
  | 'MESSAGE_DELETE_BULK'
  | 'MESSAGE_REACTION_ADD'
  | 'MESSAGE_REACTION_REMOVE'
  | 'MESSAGE_REACTION_REMOVE_ALL'
  | 'MESSAGE_REACTION_REMOVE_EMOJI'
  | 'USER_UPDATE'
  | 'PRESENCE_UPDATE'
  | 'TYPING_START'
  | 'VOICE_STATE_UPDATE'
  | 'VOICE_SERVER_UPDATE'
  | 'WEBHOOKS_UPDATE'

export type Payload = {
  op: Opcode
  d?: Data
  t?: WSEventType
  s?: number
}

export interface Application {
  id: string
  flag: number
}

export interface Guild {
  unavailable: boolean
  id: string
}

export interface Data extends DiscordMessage {
  v: number
  user_settings: {}
  user: User
  session_id: string
  relationships: []
  private_channels: []
  presences: []
  guilds: Guild[]
  guild_join_requests: []
  geo_ordered_rtc_regions: string[]
  application: Application
  heartbeat_interval?: number
}

export interface User {
  verified: boolean
  username: string
  mfa_enabled: boolean
  id: string
  flags: number
  email: string
  discriminator: string
  bot: boolean
  avatar: string
}

export interface Author {
  username: string
  id: string
  avatar: string
  public_flags: number
  discriminator: string
}

export interface DiscordMessage {
  guild_id?: string
  content: string
  author: Author
  id: string
  timestamp: string
  channel_id: string
  attachments: Attachment[]
  embeds: Embed[]
  message_reference?: MessageReference
}

export interface MessageReference {
  message_id?: string
  channel_id?: string
  guild_id?: string
}

export interface Embed {
  title?: string
  type?: 'rich' | 'image' | 'video' | 'gifv' | 'article' | 'link'
  description?: string
  url?: string
  timestamp: string
  video?: {
    url?: string
    proxy_url?: string
    height?: number
    width?: number
  }
}

export interface Attachment {
  id: string
  filename: string
  size: number
  url: string
  proxy_url: string
  height?: number
  width?: number
}

export interface DiscordUser {
  id: string
  username: string
  discriminator: string
  bot?: boolean
  avatar: string | null
  system?: boolean
}

export enum Opcode {
  Hello = 10,
  Identify = 2,
  Dispatch = 0,
  HeartbeatACK = 11,
  Heartbeat = 1,
  Resume = 6,
  Reconnect = 7,
}

export interface PartialGuild {
  id: string
  name: string
}

export interface GuildMember {
  user?: DiscordUser
}

export interface ExecuteWebhookBody{
  content: string
  username?: string
  avatar_url?: string
}

export interface DiscordChannel {
  id: string
  type: number
  guild_id?: string
  name?: string
}
