import { integer, Internal, snowflake, timestamp, User } from '.'

/** https://discord.com/developers/docs/resources/guild#integration-object-integration-structure */
export interface Integration {
  /** integration id */
  id: snowflake
  /** integration name */
  name: string
  /** integration type (twitch, youtube, or discord) */
  type: string
  /** is this integration enabled */
  enabled: boolean
  /** is this integration syncing */
  syncing?: boolean
  /** id that this integration uses for "subscribers" */
  role_id?: snowflake
  /** whether emoticons should be synced for this integration (twitch only currently) */
  enable_emoticons?: boolean
  /** the behavior of expiring subscribers */
  expire_behavior?: IntegrationExpireBehavior
  /** the grace period (in days) before expiring subscribers */
  expire_grace_period?: integer
  /** user for this integration */
  user?: User
  /** integration account information */
  account: IntegrationAccount
  /** when this integration was last synced */
  synced_at?: timestamp
  /** how many subscribers this integration has */
  subscriber_count?: integer
  /** has this integration been revoked */
  revoked?: boolean
  /** The bot/OAuth2 application for discord integrations */
  application?: IntegrationApplication
}

/** https://discord.com/developers/docs/resources/guild#integration-object-integration-expire-behaviors */
export enum IntegrationExpireBehavior {
  REMOVE_ROLE = 0,
  KICK = 1,
}

/** https://discord.com/developers/docs/resources/guild#integration-account-object-integration-account-structure */
export interface IntegrationAccount {
  /** id of the account */
  id: string
  /** name of the account */
  name: string
}

/** https://discord.com/developers/docs/resources/guild#integration-application-object-integration-application-structure */
export interface IntegrationApplication {
  /** the id of the app */
  id: snowflake
  /** the name of the app */
  name: string
  /** the icon hash of the app */
  icon?: string
  /** the description of the app */
  description: string
  /** the summary of the app */
  summary: string
  /** the bot associated with this application */
  bot?: User
}

/** https://discord.com/developers/docs/topics/gateway#guild-integrations-update-guild-integrations-update-event-fields */
export interface GuildIntegrationsUpdateEvent {
  /** id of the guild whose integrations were updated */
  guild_id: snowflake
}

/** https://discord.com/developers/docs/topics/gateway#integration-create-integration-create-event-additional-fields */
export interface IntegrationCreateEvent extends Integration {
  /** id of the guild */
  guild_id: snowflake
}

/** https://discord.com/developers/docs/topics/gateway#integration-update-integration-update-event-additional-fields */
export interface IntegrationUpdateEvent extends Integration {
  /** id of the guild */
  guild_id: snowflake
}

/** https://discord.com/developers/docs/topics/gateway#integration-delete-integration-delete-event-fields */
export interface IntegrationDeleteEvent {
  /** integration id */
  id: snowflake
  /** id of the guild */
  guild_id: snowflake
  /** id of the bot/OAuth2 application for this discord integration */
  application_id?: snowflake
}

declare module './gateway' {
  interface GatewayEvents {
    /** guild integration was updated */
    GUILD_INTEGRATIONS_UPDATE: GuildIntegrationsUpdateEvent
    /** guild integration was created */
    INTEGRATION_CREATE: IntegrationCreateEvent
    /** guild integration was updated */
    INTEGRATION_UPDATE: IntegrationUpdateEvent
    /** guild integration was deleted */
    INTEGRATION_DELETE: IntegrationDeleteEvent
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Returns a list of integration objects for the guild. Requires the MANAGE_GUILD permission.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-integrations
     */
    getGuildIntegrations(guild_id: snowflake): Promise<Integration[]>
    /**
     * Delete the attached integration object for the guild. Deletes any associated webhooks and kicks the associated bot if there is one. Requires the MANAGE_GUILD permission. Returns a 204 empty response on success. Fires a Guild Integrations Update Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#delete-guild-integration
     */
    deleteGuildIntegration(guild_id: snowflake, integration_id: snowflake): Promise<void>
  }
}

Internal.define({
  '/guilds/{guild.id}/integrations': {
    GET: 'getGuildIntegrations',
  },
  '/guilds/{guild.id}/integrations/{integration.id}': {
    DELETE: 'deleteGuildIntegration',
  },
})
