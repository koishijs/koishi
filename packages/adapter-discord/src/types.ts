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
  d?: any
  t?: WSEventType
  s?: number
}

export type snowflake = string

/** https://discord.com/developers/docs/resources/emoji#emoji-object */
export interface Emoji {
  id?: snowflake
  name?: string
  roles?: snowflake[]
  user?: User
  require_colons?: boolean
  managed?: boolean
  animated?: boolean
  available?: boolean
}

/** https://discord.com/developers/docs/resources/channel#channel-object-channel-structure */
export interface Channel {
  id: snowflake;
  type: number;
  guild_id?: string;
  position?: number;
  permission_overwrites?: Overwrite[];
  name?: string;
  topic?: string;
  nsfw?: boolean;
  last_message_id?: snowflake;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  recipients?: User[];
  icon?: string;
  owner_id?: snowflake;
  application_id?: snowflake;
  parent_id?: snowflake;
  last_pin_timestamp?: ISO8601;
}

export interface ModifyGuild extends Pick<Channel, 'name' | 'type' | 'position' | 'topic' | 'nsfw' | 'rate_limit_per_user' | 'bitrate' | 'user_limit' | 'permission_overwrites' | 'parent_id'> {}

/** https://discord.com/developers/docs/resources/guild#guild-object-guild-structure */
export interface Guild {
  id: snowflake;
  name: string;
  icon?: string;
  icon_hash?: string;
  splash?: string;
  discovery_splash?: string;
  owner?: boolean;
  owner_id: snowflake;
  permissions?: string;
  region: string;
  afk_channel_id: snowflake;
  afk_timeout: number;
  widget_enabled?: boolean;
  widget_channel_id?: snowflake;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  roles: Role[];
  emojis: Emoji[];
  features: string[];
  mfa_level: number;
  application_id: snowflake;
  system_channel_id: snowflake;
  system_channel_flags: number;
  rules_channel_id: snowflake;
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
  public_updates_channel_id?: snowflake;
  max_video_channel_users?: number;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  welcome_screen?: any;
}

export interface GuildBody extends Pick<Guild, 'name' | 'region' | 'verification_level' | 'default_message_notifications' | 'explicit_content_filter' | 'afk_channel_id' | 'afk_timeout' | 'icon' | 'owner_id' | 'splash' | 'banner' | 'system_channel_id' | 'rules_channel_id' | 'public_updates_channel_id' | 'preferred_locale'> {
}

/** https://discord.com/developers/docs/resources/user#user-object-user-structure */
export interface User {
  id: snowflake
  username: string
  discriminator: string
  avatar?: string
  bot?: boolean
  system?: boolean
  mfa_enabled?: boolean
  locale?: string
  verified?: boolean
  email?: string
  flags: number
  premium_type?: number;
  public_flags?: number
}

export type ISO8601 = string

/** https://discord.com/developers/docs/resources/channel#channel-mention-object-channel-mention-structure */
export interface ChannelMention {
  id: snowflake
  guild_id: snowflake
  type: number
  name: string
}

/** https://discord.com/developers/docs/resources/channel#reaction-object-reaction-structure */
export interface Reaction {
  count: number;
  me: boolean;
  emoji: Partial<Emoji>
}

/** https://discord.com/developers/docs/resources/channel#message-object-message-activity-structure */
export interface MessageActivity {
  type: number;
  party_id?: string
}

/** https://discord.com/developers/docs/resources/channel#message-object-message-application-structure */
export interface MessageApplication {
  id: snowflake;
  cover_image?: string
  description: string;
  icon?: string;
  name: string
}

/** https://discord.com/developers/docs/resources/channel#message-object-message-sticker-structure */
export interface Sticker {
  id: snowflake;
  pack_id: snowflake;
  name: string;
  description: string;
  tags?: string;
  asset: string;
  preview_asset?: string;
  format_type: number
}

/** https://discord.com/developers/docs/interactions/slash-commands#messageinteraction */
export interface MessageInteraction {
  id: snowflake;
  type: number;
  name: string;
  user: User
}

/** https://discord.com/developers/docs/resources/channel#message-object-message-structure */
export interface Message {
  id: snowflake
  channel_id: snowflake
  guild_id?: snowflake
  author: User
  member?: Partial<GuildMember>
  content: string
  timestamp: ISO8601
  edited_timestamp: ISO8601
  tts: boolean
  mention_everyone: boolean
  mentions: User[];
  mention_roles: snowflake[]
  mention_channels: ChannelMention[]
  attachments: Attachment[]
  embeds: Embed[]
  reactions?: Reaction[]
  nonce?: string | number
  pinned: boolean
  webhook_id?: snowflake
  type: number
  activity?: MessageActivity
  application?: MessageApplication
  message_reference?: MessageReference
  flags?: number
  stickers?: Sticker[]
  referenced_message?: Message
  interaction?: MessageInteraction
}

/** https://discord.com/developers/docs/resources/channel#message-object-message-reference-structure */
export interface MessageReference {
  message_id?: snowflake
  channel_id?: snowflake
  guild_id?: snowflake
  fail_if_not_exists?: boolean
}

/** https://discord.com/developers/docs/resources/channel#embed-object-embed-structure */
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

/** https://discord.com/developers/docs/resources/channel#attachment-object-attachment-structure */
export interface Attachment {
  id: snowflake
  filename: string
  size: number
  url: string
  proxy_url: string
  height?: number
  width?: number
  content_type?: string
}

/** https://discord.com/developers/docs/resources/user#user-object-user-structure */
export interface DiscordUser {
  id: snowflake
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

/** https://discord.com/developers/docs/topics/opcodes-and-status-codes */
export enum Opcode {
  Hello = 10,
  Identify = 2,
  Dispatch = 0,
  HeartbeatACK = 11,
  Heartbeat = 1,
  Resume = 6,
  Reconnect = 7,
}

/** https://discord.com/developers/docs/resources/user#get-current-user-guilds-example-partial-guild */
export interface PartialGuild extends Pick<Guild, 'id' | 'name' | 'icon' | 'owner' | 'permissions' | 'features'> {
}

/** https://discord.com/developers/docs/resources/guild#guild-member-object-guild-member-structure */
export interface GuildMember {
  user?: DiscordUser
  nick?: string
  roles: snowflake[]
  joined_at: string;
  premium_since?: string;
  deaf: boolean;
  mute: boolean;
  pending?: boolean;
  permissions?: string
}

export interface ModifyGuildMember extends Pick<GuildMember, 'nick' | 'roles' | 'mute' | 'deaf'> {
  channel_id: snowflake
}

export type AllowedMentionType = 'roles' | 'users' | 'everyone'

/** https://discord.com/developers/docs/resources/channel#allowed-mentions-object */
export interface AllowedMention {
  parse?: AllowedMentionType[]
  roles?: snowflake[]
  users?: snowflake[]
  replied_user?: boolean
}

/** https://discord.com/developers/docs/resources/webhook#execute-webhook-jsonform-params */
export interface ExecuteWebhookBody {
  content: string
  username?: string
  avatar_url?: string
  tts?: boolean;
  embeds?: Embed[]
  common_embeds?: Embed[]
  allowed_mentions?: AllowedMention[]
}

/** https://discord.com/developers/docs/resources/channel#overwrite-object-overwrite-structure */
export interface Overwrite {
  id: snowflake;
  type: 0 | 1;
  allow: string;
  deny: string;
}

/** https://discord.com/developers/docs/topics/permissions#role-object-role-structure */
export interface Role {
  id: snowflake
  name: string
  color: number;
  hoist: boolean
  position: number
  permissions: string
  managed: boolean
  mentionable: boolean
  tags?: {
    bot_id: snowflake
    integration_id: snowflake
    premium_subscriber: null
  }
}

/** https://discord.com/developers/docs/resources/guild#create-guild-role-json-params */
export interface GuildRoleBody {
  name: string;
  permissions: string
  color: number;
  hoist: boolean;
  mentionable: boolean
}

/** https://discord.com/developers/docs/resources/webhook#webhook-object-webhook-structure */
export interface Webhook {
  id: snowflake;
  type: number;
  guild_id?: snowflake;
  channel_id: snowflake;
  user?: User;
  name?: string;
  avatar?: string;
  token?: string;
  application_id: snowflake
}
