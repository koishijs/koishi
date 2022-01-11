import { Emoji, GuildMember, integer, Internal, snowflake } from '.'

/** https://discord.com/developers/docs/resources/channel#reaction-object-reaction-structure */
export interface Reaction {
  /** times this emoji has been used to react */
  count: integer
  /** whether the current user reacted using this emoji */
  me: boolean
  /** emoji information */
  emoji: Partial<Emoji>
}

export namespace Reaction {
  export namespace Event {
    /** https://discord.com/developers/docs/topics/gateway#message-reaction-add-message-reaction-add-event-fields */
    export interface Add {
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
    export interface Remove {
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
    export interface RemoveAll {
      /** the id of the channel */
      channel_id: snowflake
      /** the id of the message */
      message_id: snowflake
      /** the id of the guild */
      guild_id?: snowflake
    }

    /** https://discord.com/developers/docs/topics/gateway#message-reaction-remove-emoji-message-reaction-remove-emoji */
    export interface RemoveEmoji {
      /** the id of the channel */
      channel_id: snowflake
      /** the id of the guild */
      guild_id?: snowflake
      /** the id of the message */
      message_id: snowflake
      /** the emoji that was removed */
      emoji: Partial<Emoji>
    }
  }

  export interface GetParams {
    /** get users after this user ID */
    after?: snowflake
    /** max number of users to return (1-100) */
    limit?: integer
  }
}

declare module './gateway' {
  interface GatewayEvents {
    /** user reacted to a message */
    MESSAGE_REACTION_ADD: Reaction.Event.Add
    /** user removed a reaction from a message */
    MESSAGE_REACTION_REMOVE: Reaction.Event.Remove
    /** all reactions were explicitly removed from a message */
    MESSAGE_REACTION_REMOVE_ALL: Reaction.Event.RemoveAll
    /** all reactions for a given emoji were explicitly removed from a message */
    MESSAGE_REACTION_REMOVE_EMOJI: Reaction.Event.RemoveEmoji
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Create a reaction for the message. This endpoint requires the 'READ_MESSAGE_HISTORY' permission to be present on the current user. Additionally, if nobody else has reacted to the message using this emoji, this endpoint requires the 'ADD_REACTIONS' permission to be present on the current user. Returns a 204 empty response on success. The emoji must be URL Encoded or the request will fail with 10014: Unknown Emoji. To use custom emoji, you must encode it in the format name:id with the emoji name and emoji id.
     * @see https://discord.com/developers/docs/resources/channel#create-reaction
     */
    createReaction(channel_id: snowflake, message_id: snowflake, emoji: string): Promise<void>
    /**
     * Delete a reaction the current user has made for the message. Returns a 204 empty response on success. The emoji must be URL Encoded or the request will fail with 10014: Unknown Emoji. To use custom emoji, you must encode it in the format name:id with the emoji name and emoji id.
     * @see https://discord.com/developers/docs/resources/channel#delete-own-reaction
     */
    deleteOwnReaction(channel_id: snowflake, message_id: snowflake, emoji: string): Promise<void>
    /**
     * Deletes another user's reaction. This endpoint requires the 'MANAGE_MESSAGES' permission to be present on the current user. Returns a 204 empty response on success. The emoji must be URL Encoded or the request will fail with 10014: Unknown Emoji. To use custom emoji, you must encode it in the format name:id with the emoji name and emoji id.
     * @see https://discord.com/developers/docs/resources/channel#delete-user-reaction
     */
    deleteUserReaction(channel_id: snowflake, message_id: snowflake, emoji: string, user_id: snowflake): Promise<void>
    /**
     * Get a list of users that reacted with this emoji. Returns an array of user objects on success. The emoji must be URL Encoded or the request will fail with 10014: Unknown Emoji. To use custom emoji, you must encode it in the format name:id with the emoji name and emoji id.
     * @see https://discord.com/developers/docs/resources/channel#get-reactions
     */
    getReactions(channel_id: snowflake, message_id: snowflake, emoji: string, params?: Reaction.GetParams): Promise<Reaction[]>
    /**
     * Deletes all reactions on a message. This endpoint requires the 'MANAGE_MESSAGES' permission to be present on the current user. Fires a Message Reaction Remove All Gateway event.
     * @see https://discord.com/developers/docs/resources/channel#delete-all-reactions
     */
    deleteAllReactions(channel_id: snowflake, message_id: snowflake): Promise<void>
    /**
     * Deletes all the reactions for a given emoji on a message. This endpoint requires the MANAGE_MESSAGES permission to be present on the current user. Fires a Message Reaction Remove Emoji Gateway event. The emoji must be URL Encoded or the request will fail with 10014: Unknown Emoji. To use custom emoji, you must encode it in the format name:id with the emoji name and emoji id.
     * @see https://discord.com/developers/docs/resources/channel#delete-all-reactions-for-emoji
     */
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
