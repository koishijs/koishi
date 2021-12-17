import { GuildMember, integer, Internal, snowflake, User } from '.'

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

export interface ModifyGuildEmojiOptions {
  /** name of the emoji */
  name?: string
  /** array of snowflakes	roles allowed to use this emoji */
  roles?: snowflake[]
}

export interface CreateGuildEmojiOptions extends ModifyGuildEmojiOptions {
  /** the 128x128 emoji image */
  image: string
}

declare module './internal' {
  interface Internal {
    /** https://discord.com/developers/docs/resources/emoji#list-guild-emojis */
    listGuildEmojis(guild_id: snowflake): Promise<Emoji[]>
    /** https://discord.com/developers/docs/resources/emoji#get-guild-emoji */
    getGuildEmoji(guild_id: snowflake, emoji_id: snowflake): Promise<Emoji>
    /** https://discord.com/developers/docs/resources/emoji#create-guild-emoji */
    createGuildEmoji(guild_id: snowflake, options: CreateGuildEmojiOptions): Promise<Emoji>
    /** https://discord.com/developers/docs/resources/emoji#modify-guild-emoji */
    modifyGuildEmoji(guild_id: snowflake, emoji_id: snowflake, options: ModifyGuildEmojiOptions): Promise<Emoji>
    /** https://discord.com/developers/docs/resources/emoji#delete-guild-emoji */
    deleteGuildEmoji(guild_id: snowflake, emoji_id: snowflake): Promise<void>
  }
}

Internal.define({
  '/guilds/{guild.id}/emojis': {
    GET: 'listGuildEmojis',
    POST: 'createGuildEmoji',
  },
  '/guilds/{guild.id}/emojis/{emoji.id}': {
    GET: 'getGuildEmoji',
    PATCH: 'modifyGuildEmoji',
    DELETE: 'deleteGuildEmoji',
  },
})

export interface GetReactionsOptions {
  /** get users after this user ID */
  after?: snowflake
  /** max number of users to return (1-100) */
  limit?: integer
}

declare module './internal' {
  interface Internal {
    /** https://discord.com/developers/docs/resources/channel#create-reaction */
    createReaction(channel_id: snowflake, message_id: snowflake, emoji: string): Promise<void>
    /** https://discord.com/developers/docs/resources/channel#delete-own-reaction */
    deleteOwnReaction(channel_id: snowflake, message_id: snowflake, emoji: string): Promise<void>
    /** https://discord.com/developers/docs/resources/channel#delete-user-reaction */
    deleteUserReaction(channel_id: snowflake, message_id: snowflake, emoji: string, user_id: snowflake): Promise<void>
    /** https://discord.com/developers/docs/resources/channel#get-reactions */
    getReactions(channel_id: snowflake, message_id: snowflake, emoji: string, options?: GetReactionsOptions): Promise<Reaction[]>
    /** https://discord.com/developers/docs/resources/channel#delete-all-reactions */
    deleteAllReactions(channel_id: snowflake, message_id: snowflake): Promise<void>
    /** https://discord.com/developers/docs/resources/channel#delete-all-reactions-for-emoji */
    deleteAllReactionsForEmoji(channel_id: snowflake, message_id: snowflake, emoji: string): Promise<void>
  }
}

Internal.define({
  '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me': {
    PUT: 'createReaction',
    DELETE: 'deleteOwnReaction',
  },
  '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/{user.id}': {
    DELETE: 'deleteUserReaction',
  },
  '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}': {
    GET: 'getReactions',
    DELETE: 'deleteAllReactionsforEmoji',
  },
  '/channels/{channel.id}/messages/{message.id}/reactions': {
    DELETE: 'deleteAllReactions',
  },
})
