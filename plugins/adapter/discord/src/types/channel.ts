import { GuildMember, integer, Internal, snowflake, timestamp, User } from '.'

/** https://discord.com/developers/docs/resources/channel#channel-object-channel-structure */
export interface Channel {
  /** the id of this channel */
  id: snowflake
  /** the type of channel */
  type: Channel.Type
  /** the id of the guild (may be missing for some channel objects received over gateway guild dispatches) */
  guild_id?: snowflake
  /** sorting position of the channel */
  position?: integer
  /** explicit permission overwrites for members and roles */
  permission_overwrites?: Overwrite[]
  /** the name of the channel (1-100 characters) */
  name?: string
  /** the channel topic (0-1024 characters) */
  topic?: string
  /** whether the channel is nsfw */
  nsfw?: boolean
  /** the id of the last message sent in this channel (may not point to an existing or valid message) */
  last_message_id?: snowflake
  /** the bitrate (in bits) of the voice channel */
  bitrate?: integer
  /** the user limit of the voice channel */
  user_limit?: integer
  /** amount of seconds a user has to wait before sending another message (0-21600); bots, as well as users with the permission manage_messages or manage_channel, are unaffected */
  rate_limit_per_user?: integer
  /** the recipients of the DM */
  recipients?: User[]
  /** icon hash */
  icon?: string
  /** id of the creator of the group DM or thread */
  owner_id?: snowflake
  /** application id of the group DM creator if it is bot-created */
  application_id?: snowflake
  /** for guild channels: id of the parent category for a channel (each parent category can contain up to 50 channels), for threads: id of the text channel this thread was created */
  parent_id?: snowflake
  /** when the last pinned message was pinned. This may be null in events such as GUILD_CREATE when a message is not pinned. */
  last_pin_timestamp?: timestamp
  /** voice region id for the voice channel, automatic when set to null */
  rtc_region?: string
  /** the camera video quality mode of the voice channel, 1 when not present */
  video_quality_mode?: integer
  /** computed permissions for the invoking user in the channel, including overwrites, only included when part of the resolved data received on a slash command interaction */
  permissions?: string
}

export namespace Channel {
  /** https://discord.com/developers/docs/resources/channel#channel-object-channel-types */
  export enum Type {
    /** a text channel within a server */
    GUILD_TEXT = 0,
    /** a direct message between users */
    DM = 1,
    /** a voice channel within a server */
    GUILD_VOICE = 2,
    /** a direct message between multiple users */
    GROUP_DM = 3,
    /** an organizational category that contains up to 50 channels */
    GUILD_CATEGORY = 4,
    /** a channel that users can follow and crosspost into their own server */
    GUILD_NEWS = 5,
    /** a channel in which game developers can sell their game on Discord */
    GUILD_STORE = 6,
    /** a temporary sub-channel within a GUILD_NEWS channel */
    GUILD_NEWS_THREAD = 10,
    /** a temporary sub-channel within a GUILD_TEXT channel */
    GUILD_PUBLIC_THREAD = 11,
    /** a temporary sub-channel within a GUILD_TEXT channel that is only viewable by those invited and those with the MANAGE_THREADS permission */
    GUILD_PRIVATE_THREAD = 12,
    /** a voice channel for hosting events with an audience */
    GUILD_STAGE_VOICE = 13,
  }

  export namespace Params {
    /** https://discord.com/developers/docs/resources/user#create-dm-json-params */
    export interface CreateDM {
      /** the recipient to open a DM channel with */
      recipient_id: snowflake
    }

    /** https://discord.com/developers/docs/resources/user#create-group-dm-json-params */
    export interface CreateGroupDM {
      /** access tokens of users that have granted your app the gdm.join scope */
      access_tokens: string[]
      /** a dictionary of user ids to their respective nicknames */
      nicks: Record<string, string>
    }

    /** https://discord.com/developers/docs/resources/guild#create-guild-channel-json-params */
    export interface Create {
      /** channel name (1-100 characters) */
      name: string
      /** the type of channel */
      type: integer
      /** channel topic (0-1024 characters) */
      topic: string
      /** the bitrate (in bits) of the voice channel (voice only) */
      bitrate: integer
      /** the user limit of the voice channel (voice only) */
      user_limit: integer
      /** amount of seconds a user has to wait before sending another message (0-21600); bots, as well as users with the permission manage_messages or manage_channel, are unaffected */
      rate_limit_per_user: integer
      /** sorting position of the channel */
      position: integer
      /** the channel's permission overwrites */
      permission_overwrites: Overwrite[]
      /** id of the parent category for a channel */
      parent_id: snowflake
      /** whether the channel is nsfw */
      nsfw: boolean
    }

    /** https://discord.com/developers/docs/resources/guild#modify-guild-channel-positions-json-params */
    export interface ModifyPositions {
      /** channel id */
      id: snowflake
      /** sorting position of the channel */
      position?: integer
      /** syncs the permission overwrites with the new parent, if moving to a new category */
      lock_permissions?: boolean
      /** the new parent ID for the channel that is moved */
      parent_id?: snowflake
    }

    export type Modify =
      | Modify.GroupDM
      | Modify.GuildChannel
      | Modify.Thread

    export namespace Modify {
      /** https://discord.com/developers/docs/resources/channel#modify-channel-json-params-group-dm */
      export interface GroupDM {
        /** 1-100 character channel name */
        name: string
        /** base64 encoded icon */
        icon: string
      }

      /** https://discord.com/developers/docs/resources/channel#modify-channel-json-params-guild-channel */
      export interface GuildChannel {
        /** 1-100 character channel name */
        name: string
        /** the type of channel; only conversion between text and news is supported and only in guilds with the "NEWS" feature */
        type: integer
        /** the position of the channel in the left-hand listing */
        position?: integer
        /** 0-1024 character channel topic */
        topic?: string
        /** whether the channel is nsfw */
        nsfw?: boolean
        /** amount of seconds a user has to wait before sending another message (0-21600); bots, as well as users with the permission manage_messages or manage_channel, are unaffected */
        rate_limit_per_user?: integer
        /** the bitrate (in bits) of the voice channel; 8000 to 96000 (128000 for VIP servers) */
        bitrate?: integer
        /** the user limit of the voice channel; 0 refers to no limit, 1 to 99 refers to a user limit */
        user_limit?: integer
        /** channel or category-specific permissions */
        permission_overwrites?: Overwrite[]
        /** id of the new parent category for a channel */
        parent_id?: snowflake
        /** channel voice region id, automatic when set to null */
        rtc_region?: string
        /** the camera video quality mode of the voice channel */
        video_quality_mode?: integer
        /** the default duration that the clients use (not the API) for newly created threads in the channel, in minutes, to automatically archive the thread after recent activity */
        default_auto_archive_duration?: integer
      }

      /** https://discord.com/developers/docs/resources/channel#modify-channel-json-params-thread */
      export interface Thread {
        /** 1-100 character channel name */
        name: string
        /** whether the thread is archived */
        archived: boolean
        /** duration in minutes to automatically archive the thread after recent activity, can be set to: 60, 1440, 4320, 10080 */
        auto_archive_duration: integer
        /** whether the thread is locked; when a thread is locked, only users with MANAGE_THREADS can unarchive it */
        locked: boolean
        /** whether non-moderators can add other non-moderators to a thread; only available on private threads */
        invitable: boolean
        /** amount of seconds a user has to wait before sending another message (0-21600); bots, as well as users with the permission manage_messages, manage_thread, or manage_channel, are unaffected */
        rate_limit_per_user?: integer
      }
    }

    /** https://discord.com/developers/docs/resources/channel#edit-channel-permissions-json-params */
    export interface EditPermissions {
      /** the bitwise value of all allowed permissions */
      allow: string
      /** the bitwise value of all disallowed permissions */
      deny: string
      /** 0 for a role or 1 for a member */
      type: integer
    }

    /** https://discord.com/developers/docs/resources/channel#follow-news-channel-json-params */
    export interface Follow {
      /** id of target channel */
      webhook_channel_id: snowflake
    }

    /** https://discord.com/developers/docs/resources/channel#group-dm-add-recipient-json-params */
    export interface AddRecipient {
      /** access token of a user that has granted your app the gdm.join scope */
      access_token: string
      /** nickname of the user being added */
      nick: string
    }
  }
}

/** https://discord.com/developers/docs/resources/channel#followed-channel-object-followed-channel-structure */
export interface FollowedChannel {
  /** source channel id */
  channel_id: snowflake
  /** created target webhook id */
  webhook_id: snowflake
}

/** https://discord.com/developers/docs/resources/channel#overwrite-object-overwrite-structure */
export interface Overwrite {
  /** role or user id */
  id: snowflake
  /** either 0 (role) or 1 (member) */
  type: integer
  /** permission bit set */
  allow: string
  /** permission bit set */
  deny: string
}

/** https://discord.com/developers/docs/resources/channel#allowed-mentions-object-allowed-mention-types */
export enum AllowedMentionType {
  /** Controls role mentions */
  ROLE_MENTIONS = 'roles',
  /** Controls user mentions */
  USER_MENTIONS = 'users',
  /** Controls @everyone and @here mentions */
  EVERYONE_MENTIONS = 'everyone',
}

/** https://discord.com/developers/docs/resources/channel#allowed-mentions-object-allowed-mentions-structure */
export interface AllowedMentions {
  /** An array of allowed mention types to parse from the content. */
  parse: AllowedMentionType[]
  /** Array of role_ids to mention (Max size of 100) */
  roles: snowflake[]
  /** Array of user_ids to mention (Max size of 100) */
  users: snowflake[]
  /** For replies, whether to mention the author of the message being replied to (default false) */
  replied_user: boolean
}

export interface ChannelCreateEvent extends Channel {}

export interface ChannelUpdateEvent extends Channel {}

export interface ChannelDeleteEvent extends Channel {}

/** https://discord.com/developers/docs/topics/gateway#channel-pins-update-channel-pins-update-event-fields */
export interface ChannelPinsUpdateEvent {
  /** the id of the guild */
  guild_id?: snowflake
  /** the id of the channel */
  channel_id: snowflake
  /** the time at which the most recent pinned message was pinned */
  last_pin_timestamp?: timestamp
}

/** https://discord.com/developers/docs/topics/gateway#typing-start-typing-start-event-fields */
export interface TypingStartEvent {
  /** id of the channel */
  channel_id: snowflake
  /** id of the guild */
  guild_id?: snowflake
  /** id of the user */
  user_id: snowflake
  /** unix time (in seconds) of when the user started typing */
  timestamp: integer
  /** the member who started typing if this happened in a guild */
  member?: GuildMember
}

declare module './gateway' {
  interface GatewayEvents {
    /** new guild channel created */
    CHANNEL_CREATE: ChannelCreateEvent
    /** channel was updated */
    CHANNEL_UPDATE: ChannelUpdateEvent
    /** channel was deleted */
    CHANNEL_DELETE: ChannelDeleteEvent
    /** message was pinned or unpinned */
    CHANNEL_PINS_UPDATE: ChannelPinsUpdateEvent
    /** user started typing in a channel */
    TYPING_START: TypingStartEvent
  }
}

export interface ChannelPosition {
  /** channel id */
  channel_id: snowflake
  /** sorting position of the channel */
  position?: integer
  /** syncs the permission overwrites with the new parent, if moving to a new category */
  lock_permissions?: boolean
  /** the new parent ID for the channel that is moved */
  parent_id?: snowflake
}

declare module './internal' {
  interface Internal {
    /**
     * Create a new DM channel with a user. Returns a DM channel object.
     * @see https://discord.com/developers/docs/resources/user#create-dm
     */
    createDM(params: Channel.Params.CreateDM): Promise<void>
    /**
     * Create a new group DM channel with multiple users. Returns a DM channel object. This endpoint was intended to be used with the now-deprecated GameBridge SDK. DMs created with this endpoint will not be shown in the Discord client
     * @see https://discord.com/developers/docs/resources/user#create-group-dm
     */
    createGroupDM(params: Channel.Params.CreateGroupDM): Promise<void>
  }
}

Internal.define({
  '/users/@me/channels': {
    POST: ['createDM', 'createGroupDM'],
  },
})

declare module './internal' {
  interface Internal {
    /**
     * Returns a list of guild channel objects. Does not include threads.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-channels
     */
    getGuildChannels(guild_id: snowflake): Promise<Channel[]>
    /**
     * Create a new channel object for the guild. Requires the MANAGE_CHANNELS permission. If setting permission overwrites, only permissions your bot has in the guild can be allowed/denied. Setting MANAGE_ROLES permission in channels is only possible for guild administrators. Returns the new channel object on success. Fires a Channel Create Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#create-guild-channel
     */
    createGuildChannel(guild_id: snowflake, params: Channel.Params.Create): Promise<Channel>
    /**
     * Modify the positions of a set of channel objects for the guild. Requires MANAGE_CHANNELS permission. Returns a 204 empty response on success. Fires multiple Channel Update Gateway events.
     * @see https://discord.com/developers/docs/resources/guild#modify-guild-channel-positions
     */
    modifyGuildChannelPositions(guild_id: snowflake, params: Channel.Params.ModifyPositions): Promise<void>
  }
}

Internal.define({
  '/guilds/{guild.id}/channels': {
    GET: 'getGuildChannels',
    POST: 'createGuildChannel',
    PATCH: 'modifyGuildChannelPositions',
  },
})

declare module './internal' {
  interface Internal {
    /**
     * Get a channel by ID. Returns a channel object. If the channel is a thread, a thread member object is included in the returned result.
     * @see https://discord.com/developers/docs/resources/channel#get-channel
     */
    getChannel(channel_id: snowflake): Promise<Channel>
    /**
     * Update a channel's settings. Returns a channel on success, and a 400 BAD REQUEST on invalid parameters. All JSON parameters are optional.
     * @see https://discord.com/developers/docs/resources/channel#modify-channel
     */
    modifyChannel(channel_id: snowflake, params: Channel.Params.Modify): Promise<Channel>
    /**
     * Delete a channel, or close a private message. Requires the MANAGE_CHANNELS permission for the guild, or MANAGE_THREADS if the channel is a thread. Deleting a category does not delete its child channels; they will have their parent_id removed and a Channel Update Gateway event will fire for each of them. Returns a channel object on success. Fires a Channel Delete Gateway event (or Thread Delete if the channel was a thread).
     * @see https://discord.com/developers/docs/resources/channel#deleteclose-channel
     */
    deleteChannel(channel_id: snowflake): Promise<Channel>
    /**
     * Edit the channel permission overwrites for a user or role in a channel. Only usable for guild channels. Requires the MANAGE_ROLES permission. Only permissions your bot has in the guild or channel can be allowed/denied (unless your bot has a MANAGE_ROLES overwrite in the channel). Returns a 204 empty response on success. For more information about permissions, see permissions.
     * @see https://discord.com/developers/docs/resources/channel#edit-channel-permissions
     */
    editChannelPermissions(channel_id: snowflake, overwrite_id: string, params: Channel.Params.EditPermissions): Promise<void>
    /**
     * Delete a channel permission overwrite for a user or role in a channel. Only usable for guild channels. Requires the MANAGE_ROLES permission. Returns a 204 empty response on success. For more information about permissions, see permissions
     * @see https://discord.com/developers/docs/resources/channel#delete-channel-permission
     */
    deleteChannelPermission(channel_id: snowflake, overwrite_id: string): Promise<void>
    /**
     * Follow a News Channel to send messages to a target channel. Requires the MANAGE_WEBHOOKS permission in the target channel. Returns a followed channel object.
     * @see https://discord.com/developers/docs/resources/channel#follow-news-channel
     */
    followNewsChannel(channel_id: snowflake, params: Channel.Params.Follow): Promise<void>
    /**
     * Post a typing indicator for the specified channel. Generally bots should not implement this route. However, if a bot is responding to a command and expects the computation to take a few seconds, this endpoint may be called to let the user know that the bot is processing their message. Returns a 204 empty response on success. Fires a Typing Start Gateway event.
     * @see https://discord.com/developers/docs/resources/channel#trigger-typing-indicator
     */
    triggerTypingIndicator(channel_id: snowflake): Promise<void>
    /**
     * Adds a recipient to a Group DM using their access token.
     * @see https://discord.com/developers/docs/resources/channel#group-dm-add-recipient
     */
    groupDMAddRecipient(channel_id: snowflake, user_id: snowflake, params: Channel.Params.AddRecipient): Promise<void>
    /**
     * Removes a recipient from a Group DM.
     * @see https://discord.com/developers/docs/resources/channel#group-dm-remove-recipient
     */
    groupDMRemoveRecipient(channel_id: snowflake, user_id: snowflake): Promise<void>
  }
}

Internal.define({
  '/channels/{channel.id}': {
    GET: 'getChannel',
    PATCH: 'modifyChannel',
    DELETE: 'deleteChannel',
  },
  '/channels/{channel.id}/permissions/{overwrite.id}': {
    PUT: 'editChannelPermissions',
    DELETE: 'deleteChannelPermission',
  },
  '/channels/{channel.id}/followers': {
    POST: 'followNewsChannel',
  },
  '/channels/{channel.id}/typing': {
    POST: 'triggerTypingIndicator',
  },
  '/channels/{channel.id}/recipients/{user.id}': {
    PUT: 'groupDMAddRecipient',
    DELETE: 'groupDMRemoveRecipient',
  },
})
