import { GuildMember, integer, Internal, snowflake, timestamp, User } from '.'

/** https://discord.com/developers/docs/resources/guild-scheduled-event#guild-scheduled-event-object-guild-scheduled-event-structure */
export interface GuildScheduledEvent {
  /** the id of the scheduled event */
  id: snowflake
  /** the guild id which the scheduled event belongs to */
  guild_id: snowflake
  /** the channel id in which the scheduled event will be hosted, or null if scheduled entity type is EXTERNAL */
  channel_id?: snowflake
  /** the id of the user that created the scheduled event * */
  creator_id?: snowflake
  /** the name of the scheduled event (1-100 characters) */
  name: string
  /** the description of the scheduled event (1-1000 characters) */
  description?: string
  /** the time the scheduled event will start */
  scheduled_start_time: timestamp
  /** the time the scheduled event will end, required if entity_type is EXTERNAL */
  scheduled_end_time?: timestamp
  /** the privacy level of the scheduled event */
  privacy_level: GuildScheduledEvent.PrivacyLevel
  /** the status of the scheduled event */
  status: GuildScheduledEvent.Status
  /** the type of the scheduled event */
  entity_type: GuildScheduledEvent.EntityType
  /** the id of an entity associated with a guild scheduled event */
  entity_id?: snowflake
  /** additional metadata for the guild scheduled event */
  entity_metadata?: GuildScheduledEvent.EntityMetadata
  /** the user that created the scheduled event */
  creator?: User
  /** the number of users subscribed to the scheduled event */
  user_count?: integer
}

export namespace GuildScheduledEvent {
  /** https://discord.com/developers/docs/resources/guild-scheduled-event#guild-scheduled-event-object-guild-scheduled-event-privacy-level */
  export enum PrivacyLevel {
    /** the scheduled event is only accessible to guild members */
    GUILD_ONLY = 2,
  }

  /** https://discord.com/developers/docs/resources/guild-scheduled-event#guild-scheduled-event-object-guild-scheduled-event-entity-types */
  export enum EntityType {
    STAGE_INSTANCE = 1,
    VOICE = 2,
    EXTERNAL = 3,
  }

  /** https://discord.com/developers/docs/resources/guild-scheduled-event#guild-scheduled-event-object-guild-scheduled-event-status */
  export enum Status {
    SCHEDULED = 1,
    ACTIVE = 2,
    COMPLETED = 3,
    CANCELLED = 4,
  }

  /** https://discord.com/developers/docs/resources/guild-scheduled-event#guild-scheduled-event-object-guild-scheduled-event-entity-metadata */
  export interface EntityMetadata {
    /** location of the event (1-100 characters) */
    location?: string
  }

  /** https://discord.com/developers/docs/resources/guild-scheduled-event#list-scheduled-events-for-guild-query-string-params */
  export interface ListParams {
    /** include number of users subscribed to each event */
    with_user_count?: boolean
  }

  /** https://discord.com/developers/docs/resources/guild-scheduled-event#create-guild-scheduled-event-json-params */
  export interface CreateParams {
    /** the channel id of the scheduled event. */
    channel_id?: snowflake
    /** the entity metadata of the scheduled event */
    entity_metadata?: EntityMetadata
    /** the name of the scheduled event */
    name: string
    /** the privacy level of the scheduled event */
    privacy_level: PrivacyLevel
    /** the time to schedule the scheduled event */
    scheduled_start_time: timestamp
    /** the time when the scheduled event is scheduled to end */
    scheduled_end_time?: timestamp
    /** the description of the scheduled event */
    description?: string
    /** the entity type of the scheduled event */
    entity_type: EntityType
  }

  /** https://discord.com/developers/docs/resources/guild-scheduled-event#get-guild-scheduled-event-query-string-params */
  export interface GetParams {
    /** include number of users subscribed to this event */
    with_user_count?: boolean
  }

  /** https://discord.com/developers/docs/resources/guild-scheduled-event#modify-guild-scheduled-event-json-params */
  export interface ModifyParams {
    /** the channel id of the scheduled event, set to null if changing entity type to EXTERNAL */
    channel_id?: snowflake
    /** the entity metadata of the scheduled event */
    entity_metadata?: EntityMetadata
    /** the name of the scheduled event */
    name?: string
    /** the privacy level of the scheduled event */
    privacy_level?: PrivacyLevel
    /** the time to schedule the scheduled event */
    scheduled_start_time?: timestamp
    /** the time when the scheduled event is scheduled to end */
    scheduled_end_time?: timestamp
    /** the description of the scheduled event */
    description?: string
    /** the entity type of the scheduled event */
    entity_type?: EntityType
    /** the status of the scheduled event */
    status?: Status
  }
}

/** https://discord.com/developers/docs/resources/guild-scheduled-event#guild-scheduled-event-user-object-guild-scheduled-event-user-structure */
export interface GuildScheduledEventUser {
  /** the scheduled event id which the user subscribed to */
  guild_scheduled_event_id: snowflake
  /** user which subscribed to an event */
  user: User
  /** guild member data for this user for the guild which this event belongs to, if any */
  member?: GuildMember
}

export namespace GuildScheduledEventUser {
  /** https://discord.com/developers/docs/resources/guild-scheduled-event#get-guild-scheduled-event-users-query-string-params */
  export interface GetParams {
    /** number of users to return (up to maximum 100) */
    limit?: number
    /** include guild member data if it exists */
    with_member?: boolean
    /** consider only users before given user id */
    before?: snowflake
    /** consider only users after given user id */
    after?: snowflake
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Returns a list of guild scheduled event objects for the given guild.
     * @see https://discord.com/developers/docs/resources/guild-scheduled-event#list-scheduled-events-for-guild
     */
    listScheduledEventsforGuild(guildId: snowflake, params?: GuildScheduledEvent.ListParams): Promise<GuildScheduledEvent[]>
    /**
     * Create a guild scheduled event in the guild. Returns a guild scheduled event object on success.
     * @see https://discord.com/developers/docs/resources/guild-scheduled-event#create-guild-scheduled-event
     */
    createGuildScheduledEvent(guildId: snowflake, params: GuildScheduledEvent.CreateParams): Promise<GuildScheduledEvent>
    /**
     * Get a guild scheduled event. Returns a guild scheduled event object on success.
     * @see https://discord.com/developers/docs/resources/guild-scheduled-event#get-guild-scheduled-event
     */
    getGuildScheduledEvent(guildId: snowflake, eventId: snowflake, params?: GuildScheduledEvent.GetParams): Promise<GuildScheduledEvent>
    /**
     * Modify a guild scheduled event. Returns the modified guild scheduled event object on success.
     * @see https://discord.com/developers/docs/resources/guild-scheduled-event#modify-guild-scheduled-event
     */
    modifyGuildScheduledEvent(guildId: snowflake, eventId: snowflake, params: GuildScheduledEvent.ModifyParams): Promise<GuildScheduledEvent>
    /**
     * Delete a guild scheduled event. Returns a 204 on success.
     * @see https://discord.com/developers/docs/resources/guild-scheduled-event#delete-guild-scheduled-event
     */
    deleteGuildScheduledEvent(guildId: snowflake, eventId: snowflake): Promise<void>
    /**
     * Get a list of guild scheduled event users subscribed to a guild scheduled event.
     * Returns a list of guild scheduled event user objects on success.
     * Guild member data, if it exists, is included if the with_member query parameter is set.
     * @see https://discord.com/developers/docs/resources/guild-scheduled-event#get-guild-scheduled-event-users
     */
    getGuildScheduledEventUsers(guildId: snowflake, eventId: snowflake, params?: GuildScheduledEventUser.GetParams): Promise<GuildScheduledEventUser[]>
  }
}

Internal.define({
  '/guilds/{guild.id}/scheduled-events': {
    GET: 'listScheduledEventsforGuild',
    POST: 'createGuildScheduledEvent',
  },
  '/guilds/{guild.id}/scheduled-events/{guild_scheduled_event.id}': {
    GET: 'getGuildScheduledEvent',
    PATCH: 'modifyGuildScheduledEvent',
    DELETE: 'deleteGuildScheduledEvent',
  },
  '/guilds/{guild.id}/scheduled-events/{guild_scheduled_event.id}/users': {
    GET: 'getGuildScheduledEventUsers',
  },
})
