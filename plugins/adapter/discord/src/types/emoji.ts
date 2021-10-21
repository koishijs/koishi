import { GuildMember, integer, snowflake, User } from '.'

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

/** https://discord.com/developers/docs/resources/channel#reaction-object-reaction-structure */
export interface Reaction {
  /** times this emoji has been used to react */
  count: integer
  /** whether the current user reacted using this emoji */
  me: boolean
  /** emoji information */
  emoji: Partial<Emoji>
}

/** https://discord.com/developers/docs/topics/gateway#guild-emojis-update-guild-emojis-update-event-fields */
export interface GuildEmojisUpdateEvent {
  /** id of the guild */
  guild_id: snowflake
  /** array of emojis */
  emojis: Emoji[]
}

/** https://discord.com/developers/docs/topics/gateway#message-reaction-add-message-reaction-add-event-fields */
export interface MessageReactionAddEvent {
  /** the id of the user */
  user_id: snowflake
  /** the id of the channel */
  channel_id: snowflake
  /** the id of the message */
  message_id: snowflake
  /** the id of the guild */
  guild_id?: snowflake
  /** the member who reacted if this happened in a guild */
  member?: GuildMember
  /** the emoji used to react - example */
  emoji: Partial<Emoji>
}

/** https://discord.com/developers/docs/topics/gateway#message-reaction-remove-message-reaction-remove-event-fields */
export interface MessageReactionRemoveEvent {
  /** the id of the user */
  user_id: snowflake
  /** the id of the channel */
  channel_id: snowflake
  /** the id of the message */
  message_id: snowflake
  /** the id of the guild */
  guild_id?: snowflake
  /** the emoji used to react - example */
  emoji: Partial<Emoji>
}

/** https://discord.com/developers/docs/topics/gateway#message-reaction-remove-all-message-reaction-remove-all-event-fields */
export interface MessageReactionRemoveAllEvent {
  /** the id of the channel */
  channel_id: snowflake
  /** the id of the message */
  message_id: snowflake
  /** the id of the guild */
  guild_id?: snowflake
}

/** https://discord.com/developers/docs/topics/gateway#message-reaction-remove-emoji-message-reaction-remove-emoji */
export interface MessageReactionRemoveEmojiEvent {
  /** the id of the channel */
  channel_id: snowflake
  /** the id of the guild */
  guild_id?: snowflake
  /** the id of the message */
  message_id: snowflake
  /** the emoji that was removed */
  emoji: Partial<Emoji>
}

declare module './gateway' {
  interface GatewayEvents {
    /** guild emojis were updated */
    GUILD_EMOJIS_UPDATE: GuildEmojisUpdateEvent
    /** user reacted to a message */
    MESSAGE_REACTION_ADD: MessageReactionAddEvent
    /** user removed a reaction from a message */
    MESSAGE_REACTION_REMOVE: MessageReactionRemoveEvent
    /** all reactions were explicitly removed from a message */
    MESSAGE_REACTION_REMOVE_ALL: MessageReactionRemoveAllEvent
    /** all reactions for a given emoji were explicitly removed from a message */
    MESSAGE_REACTION_REMOVE_EMOJI: MessageReactionRemoveEmojiEvent
  }
}
