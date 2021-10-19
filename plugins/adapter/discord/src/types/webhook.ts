import { Channel, Guild, integer, snowflake, User } from '.'

/** https://discord.com/developers/docs/resources/webhook#webhook-object-webhook-structure */
export interface Webhook {
  /** the id of the webhook */
  id: snowflake
  /** the type of the webhook */
  type: integer
  /** the guild id this webhook is for, if any */
  guild_id?: snowflake
  /** the channel id this webhook is for, if any */
  channel_id?: snowflake
  /** the user this webhook was created by (not returned when getting a webhook with its token) */
  user?: User
  /** the default name of the webhook */
  name?: string
  /** the default user avatar hash of the webhook */
  avatar?: string
  /** the secure token of the webhook (returned for Incoming Webhooks) */
  token?: string
  /** the bot/OAuth2 application that created this webhook */
  application_id?: snowflake
  /** the guild of the channel that this webhook is following (returned for Channel Follower Webhooks) */
  source_guild?: Partial<Guild>
  /** the channel that this webhook is following (returned for Channel Follower Webhooks) */
  source_channel?: Partial<Channel>
  /** the url used for executing the webhook (returned by the webhooks OAuth2 flow) */
  url?: string
}

/** https://discord.com/developers/docs/resources/webhook#webhook-object-webhook-types */
export enum WebhookType {
  /** Incoming Webhooks can post messages to channels with a generated token */
  INCOMING = 1,
  /** Channel Follower Webhooks are internal webhooks used with Channel Following to post new messages into channels */
  CHANNEL_FOLLOWER = 2,
  /** Application webhooks are webhooks used with Interactions */
  APPLICATION = 3,
}

/** https://discord.com/developers/docs/topics/gateway#webhooks-update-webhook-update-event-fields */
export interface WebhooksUpdateEvent {
  /** id of the guild */
  guild_id: snowflake
  /** id of the channel */
  channel_id: snowflake
}

declare module './gateway' {
  interface GatewayEvents {
    /** guild channel webhook was created, update, or deleted */
    WEBHOOKS_UPDATE: WebhooksUpdateEvent
  }
}
