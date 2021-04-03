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

export interface Emoji {}

export interface Channel {
  id: string;
  type: number;
  guild_id?: string;
  position?: number;
  permission_overwrites?: Overwrite[];
  name?: string;
  topic?: string;
  nsfw?: boolean;
  last_message_id?: string;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  recipients?: User[];
  icon?: string;
  owner_id?: string;
  application_id?: string;
  parent_id?: string;
  last_pin_timestamp?: string;
}

export interface Guild {
  id: string;
  name: string;
  icon?: string ;
  icon_hash?: string;
  splash?: string;
  discovery_splash?: string;
  owner?: boolean;
  owner_id: string;
  permissions?: string;
  region: string;
  afk_channel_id: string;
  afk_timeout: number;
  widget_enabled?: boolean;
  widget_channel_id?: string;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  roles: Role[];
  emojis: Emoji[];
  features: string[];
  mfa_level: number;
  application_id: string;
  system_channel_id: string;
  system_channel_flags: number;
  rules_channel_id: string;
  joined_at?: string;
  large?: boolean;
  unavailable?: boolean;
  member_count?: number;
  voice_states?: any[];
  members?: GuildMember[];
  channels?: Channel[]
  presences?: any[];
  max_presences?: number;
  max_members?: number;
  vanity_url_code?: string;
  description?: string;
  banner?: string;
  premium_tier: number;
  premium_subscription_count?: number;
  preferred_locale: string;
  public_updates_channel_id?: string;
  max_video_channel_users?: number;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  welcome_screen?: any;
}

export interface GuildBody extends Pick<Guild, 'name' | 'region' | 'verification_level' | 'default_message_notifications' | 'explicit_content_filter' | 'afk_channel_id' | 'afk_timeout' | 'icon'| 'owner_id' | 'splash' | 'banner' | 'system_channel_id' | 'rules_channel_id' | 'public_updates_channel_id' | 'preferred_locale'> {}

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

export interface DiscordMessage {
  guild_id?: string
  content: string
  author: User
  id: string
  timestamp: string
  channel_id: string
  attachments: Attachment[]
  embeds: Embed[]
  message_reference?: MessageReference
  mention_roles: string
  mentions: User[]
  member?: {
    user?: User
    nick?: string
    roles: string[]
  }
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
  timestamp?: string
  color?: number;
  video?: {
    url?: string
    proxy_url?: string
    height?: number
    width?: number
  }
  image?: {
    url?: string
    proxy_url?: string
    height?: number
    width?: number
  }

  thumbnail?: {
    url?: string
    proxy_url?: string
    height?: number
    width?: number
  }

  footer?: {
    text: string;
    icon_url?: string;
    proxy_icon_url?: string;
  }

  author?: {
    name?: string;
    url?: string;
    icon_url?: string;
    proxy_icon_url?: string;
  }

  provider?: {
    name?: string;
    url?: string;
  }

  fields?: {
    name: string
    value: string
    inline?: boolean
  }[]
}

export interface Attachment {
  id: string
  filename: string
  size: number
  url: string
  proxy_url: string
  height?: number
  width?: number
  content_type?: string
}

export interface DiscordUser {
  id: string
  username: string
  discriminator: string
  bot?: boolean
  avatar?: string
  system?: boolean
  mfa_enabled?: boolean
  locale?: string
  verfied?: boolean
  email?: string
  premium_type?: number
  public_flags?: number
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
  nick?: string
  roles: string[]
  joined_at: string;
  premium_since?: string;
  deaf: boolean;
  mute: boolean;
  pending?: boolean;
  permissions?: string
}

export interface ExecuteWebhookBody{
  content: string
  username?: string
  avatar_url?: string
  embeds?: Embed[]
  common_embeds?: Embed[]
}

export interface Overwrite {
  id: string;
  type: 0 | 1;
  allow: string;
  deny: string;
}

export interface DiscordChannel {
  id: string
  type: number
  guild_id?: string
  position?: number
  permission_overwrites?: Overwrite[]
  name?: string
  topic?: string
  nsfw?: boolean
  last_message_id?: string
  bitrate?: number
  user_limit?: number
  rate_limit_per_user?: number
  recipients?: User[]
  icon?: string
  over_id?: string
  application_id?: string
  parent_id?: string
  last_pin_timestamp?: string
}

export interface Role {
  id: string
  name: string
  color: number;
  hoist: boolean
  position: number
  permissions: string
  managed: boolean
  mentionable: boolean
  tags?: {
    bot_id: string
    integration_id: string
  }
}
export interface GuildRoleBody {
  name: string;
  permissions: string
  color: number;
  hoist: boolean;
  mentionable: boolean
}

export interface Webhook {
  id: string;
  type: number;
  guild_id?: string;
  channel_id: string;
  user?: User;
  name?: string;
  avatar?: string;
  token?: string;
  application_id: string
}
