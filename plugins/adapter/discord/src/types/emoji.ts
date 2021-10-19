import { snowflake, User } from '.'

/** https://discord.com/developers/docs/resources/emoji#emoji-object-emoji-structure */
export interface Emoji {
  /** emoji id */
  id?: snowflake
  /** emoji name */
  name?: string
  /** roles allowed to use this emoji */
  roles?: snowflake[]
  /** user that created this emoji */
  user?: User
  /** whether this emoji must be wrapped in colons */
  require_colons?: boolean
  /** whether this emoji is managed */
  managed?: boolean
  /** whether this emoji is animated */
  animated?: boolean
  /** whether this emoji can be used, may be false due to loss of Server Boosts */
  available?: boolean
}

/** https://discord.com/developers/docs/topics/gateway#guild-emojis-update-guild-emojis-update-event-fields */
export interface GuildEmojisUpdateEvent {
  /** id of the guild */
  guild_id: snowflake
  /** array of emojis */
  emojis: Emoji[]
}

declare module './gateway' {
  interface GatewayEvents {
    /** guild emojis were updated */
    GUILD_EMOJIS_UPDATE: GuildEmojisUpdateEvent
  }
}
