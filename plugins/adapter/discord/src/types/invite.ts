import { Application, Channel, Guild, GuildMember, integer, Internal, snowflake, timestamp, User } from '.'

/** https://discord.com/developers/docs/resources/invite#invite-object-invite-structure */
export interface Invite {
  /** the invite code (unique ID) */
  code: string
  /** the guild this invite is for */
  guild?: Partial<Guild>
  /** the channel this invite is for */
  channel: Partial<Channel>
  /** the user who created the invite */
  inviter?: User
  /** the type of target for this voice channel invite */
  target_type?: Invite.TargetType
  /** the user whose stream to display for this voice channel stream invite */
  target_user?: User
  /** the embedded application to open for this voice channel embedded application invite */
  target_application?: Partial<Application>
  /** approximate count of online members, returned from the GET /invites/<code> endpoint when with_counts is true */
  approximate_presence_count?: integer
  /** approximate count of total members, returned from the GET /invites/<code> endpoint when with_counts is true */
  approximate_member_count?: integer
  /** the expiration date of this invite, returned from the GET /invites/<code> endpoint when with_expiration is true */
  expires_at?: timestamp
  /** stage instance data if there is a public Stage instance in the Stage channel this invite is for */
  stage_instance?: Invite.StageInstance
}

export namespace Invite {
  /** https://discord.com/developers/docs/resources/invite#invite-object-invite-target-types */
  export enum TargetType {
    STREAM = 1,
    EMBEDDED_APPLICATION = 2,
  }

  /** https://discord.com/developers/docs/resources/invite#invite-metadata-object-invite-metadata-structure */
  export interface Metadata extends Invite {
    /** number of times this invite has been used */
    uses: integer
    /** max number of times this invite can be used */
    max_uses: integer
    /** duration (in seconds) after which the invite expires */
    max_age: integer
    /** whether this invite only grants temporary membership */
    temporary: boolean
    /** when this invite was created */
    created_at: timestamp
  }

  /** https://discord.com/developers/docs/resources/invite#invite-stage-instance-object-invite-stage-instance-structure */
  export interface StageInstance {
    /** the members speaking in the Stage */
    members: Partial<GuildMember>[]
    /** the number of users in the Stage */
    participant_count: integer
    /** the number of users speaking in the Stage */
    speaker_count: integer
    /** the topic of the Stage instance (1-120 characters) */
    topic: string
  }

  export namespace Event {
    /** https://discord.com/developers/docs/topics/gateway#invite-create-invite-create-event-fields */
    export interface Create {
      /** the channel the invite is for */
      channel_id: snowflake
      /** the unique invite code */
      code: string
      /** the time at which the invite was created */
      created_at: timestamp
      /** the guild of the invite */
      guild_id?: snowflake
      /** the user that created the invite */
      inviter?: User
      /** how long the invite is valid for (in seconds) */
      max_age: integer
      /** the maximum number of times the invite can be used */
      max_uses: integer
      /** the type of target for this voice channel invite */
      target_type?: integer
      /** the user whose stream to display for this voice channel stream invite */
      target_user?: User
      /** the embedded application to open for this voice channel embedded application invite */
      target_application?: Partial<Application>
      /** whether or not the invite is temporary (invited users will be kicked on disconnect unless they're assigned a role) */
      temporary: boolean
      /** how many times the invite has been used (always will be 0) */
      uses: integer
    }

    /** https://discord.com/developers/docs/topics/gateway#invite-delete-invite-delete-event-fields */
    export interface Delete {
      /** the channel of the invite */
      channel_id: snowflake
      /** the guild of the invite */
      guild_id?: snowflake
      /** the unique invite code */
      code: string
    }
  }

  /** https://discord.com/developers/docs/resources/invite#get-invite-query-string-params */
  export interface GetOptions {
    /** whether to include invite metadata */
    with_counts?: boolean
    /** whether to include invite expiration date */
    with_expiration?: boolean
    /** the guild scheduled event to include with the invite */
    guild_scheduled_event_id?: snowflake
  }

  /** https://discord.com/developers/docs/resources/channel#create-channel-invite-json-params */
  export interface CreateParams {
    /** duration of invite in seconds before expiry, or 0 for never. between 0 and 604800 (7 days) */
    max_age: integer
    /** max number of uses or 0 for unlimited. between 0 and 100 */
    max_uses: integer
    /** whether this invite only grants temporary membership */
    temporary: boolean
    /** if true, don't try to reuse a similar invite (useful for creating many unique one time use invites) */
    unique: boolean
    /** the type of target for this voice channel invite */
    target_type: integer
    /** the id of the user whose stream to display for this invite, required if target_type is 1, the user must be streaming in the channel */
    target_user_id: snowflake
    /** the id of the embedded application to open for this invite, required if target_type is 2, the application must have the EMBEDDED flag */
    target_application_id: snowflake
  }
}

declare module './gateway' {
  interface GatewayEvents {
    /** invite to a channel was created */
    INVITE_CREATE: Invite.Event.Create
    /** invite to a channel was deleted */
    INVITE_DELETE: Invite.Event.Delete
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Returns an invite object for the given code.
     * @see https://discord.com/developers/docs/resources/invite#get-invite
     */
    getInvite(code: string, params?: Invite.GetOptions): Promise<Invite>
    /**
     * Delete an invite. Requires the MANAGE_CHANNELS permission on the channel this invite belongs to, or MANAGE_GUILD to remove any invite across the guild. Returns an invite object on success. Fires a Invite Delete Gateway event.
     * @see https://discord.com/developers/docs/resources/invite#delete-invite
     */
    deleteInvite(code: string): Promise<Invite>
    /**
     * Returns a list of invite objects (with invite metadata) for the guild. Requires the MANAGE_GUILD permission.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-invites
     */
    getGuildInvites(guild_id: snowflake): Promise<Invite.Metadata[]>
    /**
     * Returns a partial invite object for guilds with that feature enabled. Requires the MANAGE_GUILD permission. code will be null if a vanity url for the guild is not set.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-vanity-url
     */
    getGuildVanityURL(guild_id: snowflake): Promise<Partial<Invite>>
    /**
     * Returns a list of invite objects (with invite metadata) for the channel. Only usable for guild channels. Requires the MANAGE_CHANNELS permission.
     * @see https://discord.com/developers/docs/resources/channel#get-channel-invites
     */
    getChannelInvites(channel_id: string): Promise<Invite.Metadata[]>
    /**
     * Create a new invite object for the channel. Only usable for guild channels. Requires the CREATE_INSTANT_INVITE permission. All JSON parameters for this route are optional, however the request body is not. If you are not sending any fields, you still have to send an empty JSON object ({}). Returns an invite object. Fires an Invite Create Gateway event.
     * @see https://discord.com/developers/docs/resources/channel#create-channel-invite
     */
    createChannelInvite(channel_id: string, params: Invite.CreateParams): Promise<void>
  }
}

Internal.define({
  '/invites/{invite.code}': {
    GET: 'getInvite',
    DELETE: 'deleteInvite',
  },
  '/guilds/{guild.id}/invites': {
    GET: 'getGuildInvites',
  },
  '/guilds/{guild.id}/vanity-url': {
    GET: 'getGuildVanityURL',
  },
  '/channels/{channel.id}/invites': {
    GET: 'getChannelInvites',
    POST: 'createChannelInvite',
  },
})
