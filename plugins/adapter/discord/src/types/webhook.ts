import { AllowedMentions, Attachment, Channel, Component, Embed, Guild, Internal, Message, snowflake, User } from '.'

/** https://discord.com/developers/docs/resources/webhook#webhook-object-webhook-structure */
export interface Webhook {
  /** the id of the webhook */
  id: snowflake
  /** the type of the webhook */
  type: Webhook.Type
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

export namespace Webhook {
  /** https://discord.com/developers/docs/resources/webhook#webhook-object-webhook-types */
  export enum Type {
    /** Incoming Webhooks can post messages to channels with a generated token */
    INCOMING = 1,
    /** Channel Follower Webhooks are internal webhooks used with Channel Following to post new messages into channels */
    CHANNEL_FOLLOWER = 2,
    /** Application webhooks are webhooks used with Interactions */
    APPLICATION = 3,
  }

  /** https://discord.com/developers/docs/resources/webhook#create-webhook-json-params */
  export interface CreateParams {
    /** name of the webhook (1-80 characters) */
    name: string
    /** image for the default webhook avatar */
    avatar?: string
  }

  /** https://discord.com/developers/docs/resources/webhook#modify-webhook-json-params */
  export interface ModifyParams {
    /** the default name of the webhook */
    name: string
    /** image for the default webhook avatar */
    avatar?: string
    /** the new channel id this webhook should be moved to */
    channel_id: snowflake
  }

  /** https://discord.com/developers/docs/resources/webhook#execute-webhook-query-string-params */
  export interface ExecuteParams {
    /** waits for server confirmation of message send before response, and returns the created message body (defaults to false; when false a message that is not saved does not return an error) */
    wait: boolean
    /** Send a message to the specified thread within a webhook's channel. The thread will automatically be unarchived. */
    thread_id: snowflake
  }

  /** https://discord.com/developers/docs/resources/webhook#execute-webhook-jsonform-params */
  export interface ExecuteBody {
    /** the message contents (up to 2000 characters) */
    content: string
    /** override the default username of the webhook */
    username: string
    /** override the default avatar of the webhook */
    avatar_url: string
    /** true if this is a TTS message */
    tts: boolean
    /** embedded rich content */
    embeds: Embed[]
    /** allowed mentions for the message */
    allowed_mentions: AllowedMentions
    /** the components to include with the message */
    components: Component[]
    /** the contents of the file being sent */
    files: any
    /** JSON encoded body of non-file params */
    payload_json: string
    /** attachment objects with filename and description */
    attachments: Partial<Attachment>[]
  }

  /** https://discord.com/developers/docs/resources/webhook#get-webhook-message-query-string-params */
  export interface MessageParams {
    /** id of the thread the message is in */
    thread_id: snowflake
  }

  /** https://discord.com/developers/docs/resources/webhook#edit-webhook-message-jsonform-params */
  export interface MessageBody {
    /** the message contents (up to 2000 characters) */
    content: string
    /** embedded rich content */
    embeds: Embed[]
    /** allowed mentions for the message */
    allowed_mentions: AllowedMentions
    /** the components to include with the message */
    components: Component[]
    /** the contents of the file being sent/edited */
    files: any
    /** JSON encoded body of non-file params (multipart/form-data only) */
    payload_json: string
    /** attached files to keep and possible descriptions for new files */
    attachments: Partial<Attachment>[]
  }
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

declare module './internal' {
  interface Internal {
    /**
     * Create a new webhook. Requires the MANAGE_WEBHOOKS permission. Returns a webhook object on success. Webhook names follow our naming restrictions that can be found in our Usernames and Nicknames documentation, with the following additional stipulations:
     * @see https://discord.com/developers/docs/resources/webhook#create-webhook
     */
    createWebhook(channel_id: snowflake, params: Webhook.CreateParams): Promise<Webhook>
    /**
     * Returns a list of channel webhook objects. Requires the MANAGE_WEBHOOKS permission.
     * @see https://discord.com/developers/docs/resources/webhook#get-channel-webhooks
     */
    getChannelWebhooks(channel_id: snowflake): Promise<Webhook[]>
    /**
     * Returns a list of guild webhook objects. Requires the MANAGE_WEBHOOKS permission.
     * @see https://discord.com/developers/docs/resources/webhook#get-guild-webhooks
     */
    getGuildWebhooks(guild_id: snowflake): Promise<Webhook[]>
    /**
     * Returns the new webhook object for the given id.
     * @see https://discord.com/developers/docs/resources/webhook#get-webhook
     */
    getWebhook(webhook_id: snowflake): Promise<Webhook>
    /**
     * Same as above, except this call does not require authentication and returns no user in the webhook object.
     * @see https://discord.com/developers/docs/resources/webhook#get-webhook-with-token
     */
    getWebhookWithToken(webhook_id: snowflake, token: string): Promise<Webhook>
    /**
     * Modify a webhook. Requires the MANAGE_WEBHOOKS permission. Returns the updated webhook object on success.
     * @see https://discord.com/developers/docs/resources/webhook#modify-webhook
     */
    modifyWebhook(webhook_id: snowflake, params: Webhook.ModifyParams): Promise<Webhook>
    /**
     * Same as above, except this call does not require authentication, does not accept a channel_id parameter in the body, and does not return a user in the webhook object.
     * @see https://discord.com/developers/docs/resources/webhook#modify-webhook-with-token
     */
    modifyWebhookWithToken(webhook_id: snowflake, token: string, params: Webhook.ModifyParams): Promise<Webhook>
    /**
     * Delete a webhook permanently. Requires the MANAGE_WEBHOOKS permission. Returns a 204 No Content response on success.
     * @see https://discord.com/developers/docs/resources/webhook#delete-webhook
     */
    deleteWebhook(webhook_id: snowflake): Promise<void>
    /**
     * Same as above, except this call does not require authentication.
     * @see https://discord.com/developers/docs/resources/webhook#delete-webhook-with-token
     */
    deleteWebhookwithToken(webhook_id: snowflake, token: string): Promise<void>
    /**
     * Refer to Uploading Files for details on attachments and multipart/form-data requests.
     * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
     */
    executeWebhook(webhook_id: snowflake, token: string, body: Webhook.ExecuteBody, query: Webhook.ExecuteParams): Promise<void>
    /**
     * Refer to Slack's documentation for more information. We do not support Slack's channel, icon_emoji, mrkdwn, or mrkdwn_in properties.
     * @see https://discord.com/developers/docs/resources/webhook#execute-slackcompatible-webhook
     */
    executeSlackCompatibleWebhook(webhook_id: snowflake, token: string, body: null, query: Webhook.ExecuteParams): Promise<void>
    /**
     * Add a new webhook to your GitHub repo (in the repo's settings), and use this endpoint as the "Payload URL." You can choose what events your Discord channel receives by choosing the "Let me select individual events" option and selecting individual events for the new webhook you're configuring.
     * @see https://discord.com/developers/docs/resources/webhook#execute-githubcompatible-webhook
     */
    executeGitHubCompatibleWebhook(webhook_id: snowflake, token: string, body: null, query: Webhook.ExecuteParams): Promise<void>
    /**
     * Returns a previously-sent webhook message from the same token. Returns a message object on success.
     * @see https://discord.com/developers/docs/resources/webhook#get-webhook-message
     */
    getWebhookMessage(webhook_id: snowflake, token: string, message_id: snowflake, params: Webhook.MessageParams): Promise<Message>
    /**
     * Edits a previously-sent webhook message from the same token. Returns a message object on success.
     * @see https://discord.com/developers/docs/resources/webhook#edit-webhook-message
     */
    editWebhookMessage(webhook_id: snowflake, token: string, message_id: snowflake, body: Webhook.MessageBody, query: Webhook.MessageParams): Promise<void>
    /**
     * Deletes a message that was created by the webhook. Returns a 204 No Content response on success.
     * @see https://discord.com/developers/docs/resources/webhook#delete-webhook-message
     */
    deleteWebhookMessage(webhook_id: snowflake, token: string, message_id: snowflake, params: Webhook.MessageParams): Promise<void>
  }
}

Internal.define({
  '/channels/{channel.id}/webhooks': {
    POST: 'createWebhook',
    GET: 'getChannelWebhooks',
  },
  '/guilds/{guild.id}/webhooks': {
    GET: 'getGuildWebhooks',
  },
  '/webhooks/{webhook.id}': {
    GET: 'getWebhook',
    PATCH: 'modifyWebhook',
    DELETE: 'deleteWebhook',
  },
  '/webhooks/{webhook.id}/{webhook.token}': {
    GET: 'getWebhookwithToken',
    PATCH: 'modifyWebhookwithToken',
    DELETE: 'deleteWebhookwithToken',
    POST: 'executeWebhook',
  },
  '/webhooks/{webhook.id}/{webhook.token}/slack': {
    POST: 'executeSlackCompatibleWebhook',
  },
  '/webhooks/{webhook.id}/{webhook.token}/github': {
    POST: 'executeGitHubCompatibleWebhook',
  },
  '/webhooks/{webhook.id}/{webhook.token}/messages/{message.id}': {
    GET: 'getWebhookMessage',
    PATCH: 'editWebhookMessage',
    DELETE: 'deleteWebhookMessage',
  },
})
