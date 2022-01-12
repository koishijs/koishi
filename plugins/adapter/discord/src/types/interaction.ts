import { AllowedMentions, ApplicationCommand, Channel, Component, Embed, GuildMember, integer, Internal, Message, Role, SelectOption, snowflake, User } from '.'

/** https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-structure */
export interface Interaction {
  /** id of the interaction */
  id: snowflake
  /** id of the application this interaction is for */
  application_id: snowflake
  /** the type of interaction */
  type: InteractionType
  /** the command data payload */
  data?: InteractionData
  /** the guild it was sent from */
  guild_id?: snowflake
  /** the channel it was sent from */
  channel_id?: snowflake
  /** guild member data for the invoking user, including permissions */
  member?: GuildMember
  /** user object for the invoking user, if invoked in a DM */
  user?: User
  /** a continuation token for responding to the interaction */
  token: string
  /** read-only property, always 1 */
  version: integer
  /** for components, the message they were attached to */
  message?: Message
}

/** https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-type */
export enum InteractionType {
  PING = 1,
  APPLICATION_COMMAND = 2,
  MESSAGE_COMPONENT = 3,
}

/** https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-interaction-data-option-structure */
export interface InteractionDataOption {
  /** the name of the parameter */
  name: string
  /** value of application command option type */
  type: ApplicationCommand.OptionType
  /** the value of the pair */
  value?: any
  /** present if this option is a group or subcommand */
  options?: InteractionDataOption[]
  /** true if this option is the currently focused option for autocomplete */
  focused?: boolean
}

/** https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-data-structure */
export interface InteractionData {
  /** the ID of the invoked command */
  id: snowflake
  /** the name of the invoked command */
  name: string
  /** the type of the invoked command */
  type: integer
  /** converted users + roles + channels */
  resolved?: ResolvedData
  /** the params + values from the user */
  options?: InteractionDataOption[]
  /** the custom_id of the component */
  custom_id?: string
  /** the type of the component */
  component_type?: integer
  /** the values the user selected */
  values?: SelectOption[]
  /** id the of user or message targetted by a user or message command */
  target_id?: snowflake
}

/** https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-resolved-data-structure */
export interface ResolvedData {
  /** the ids and User objects */
  users?: Record<snowflake, User>
  /** the ids and partial Member objects */
  members?: Record<snowflake, Partial<GuildMember>>
  /** the ids and Role objects */
  roles?: Record<snowflake, Role>
  /** the ids and partial Channel objects */
  channels?: Record<snowflake, Partial<Channel>>
  /** the ids and partial Message objects */
  messages?: Record<snowflake, Partial<Message>>
}

/** https://discord.com/developers/docs/interactions/receiving-and-responding#message-interaction-object-message-interaction-structure */
export interface MessageInteraction {
  /** id of the interaction */
  id: snowflake
  /** the type of interaction */
  type: InteractionType
  /** the name of the application command */
  name: string
  /** the user who invoked the interaction */
  user: User
}

/** https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-response-structure */
export interface InteractionResponse {
  /** the type of response */
  type: InteractionCallbackType
  /** an optional response message */
  data?: InteractionCallbackData
}

/** https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-type */
export enum InteractionCallbackType {
  /** ACK a Ping */
  PONG = 1,
  /** respond to an interaction with a message */
  CHANNEL_MESSAGE_WITH_SOURCE = 4,
  /** ACK an interaction and edit a response later, the user sees a loading state */
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
  /** for components, ACK an interaction and edit the original message later; the user does not see a loading state */
  DEFERRED_UPDATE_MESSAGE = 6,
  /** for components, edit the message the component was attached to */
  UPDATE_MESSAGE = 7,
}

/** https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-data-structure */
export interface InteractionCallbackData {
  /** is the response TTS */
  tts?: boolean
  /** message content */
  content?: string
  /** supports up to 10 embeds */
  embeds?: Embed[]
  /** allowed mentions object */
  allowed_mentions?: AllowedMentions
  /** interaction callback data flags */
  flags?: integer
  /** message components */
  components?: Component[]
}

/** https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-data-flags */
export enum InteractionCallbackDataFlag {
  /** only the user receiving the message can see it */
  EPHEMERAL = 1 << 6,
}

export interface InteractionCreateEvent extends Interaction {}

declare module './gateway' {
  interface GatewayEvents {
    /** user used an interaction, such as an Application Command */
    INTERACTION_CREATE: InteractionCreateEvent
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Create a response to an Interaction from the gateway. Takes an interaction response. This endpoint also supports file attachments similar to the webhook endpoints. Refer to Uploading Files for details on uploading files and multipart/form-data requests.
     * @see https://discord.com/developers/docs/interactions/receiving-and-responding#create-interaction-response
     */
    createInteractionResponse(interaction_id: snowflake, token: string, params: InteractionResponse): Promise<void>
    /**
     * Returns the initial Interaction response. Functions the same as Get Webhook Message.
     * @see https://discord.com/developers/docs/interactions/receiving-and-responding#get-original-interaction-response
     */
    getOriginalInteractionResponse(application_id: snowflake, token: string): Promise<InteractionResponse>
    /**
     * Edits the initial Interaction response. Functions the same as Edit Webhook Message.
     * @see https://discord.com/developers/docs/interactions/receiving-and-responding#edit-original-interaction-response
     */
    editOriginalInteractionResponse(application_id: snowflake, token: string): Promise<InteractionResponse>
    /**
     * Deletes the initial Interaction response. Returns 204 No Content on success.
     * @see https://discord.com/developers/docs/interactions/receiving-and-responding#delete-original-interaction-response
     */
    deleteOriginalInteractionResponse(application_id: snowflake, token: string): Promise<void>
    /**
     * Create a followup message for an Interaction. Functions the same as Execute Webhook, but wait is always true, and flags can be set to 64 in the body to send an ephemeral message. The thread_id, avatar_url, and username parameters are not supported when using this endpoint for interaction followups.
     * @see https://discord.com/developers/docs/interactions/receiving-and-responding#create-followup-message
     */
    createFollowupMessage(application_id: snowflake, token: string): Promise<any>
    /**
     * Returns a followup message for an Interaction. Functions the same as Get Webhook Message. Does not support ephemeral followups.
     * @see https://discord.com/developers/docs/interactions/receiving-and-responding#get-followup-message
     */
    getFollowupMessage(application_id: snowflake, token: string, message_id: snowflake): Promise<any>
    /**
     * Edits a followup message for an Interaction. Functions the same as Edit Webhook Message. Does not support ephemeral followups.
     * @see https://discord.com/developers/docs/interactions/receiving-and-responding#edit-followup-message
     */
    editFollowupMessage(application_id: snowflake, token: string, message_id: snowflake): Promise<any>
    /**
     * Deletes a followup message for an Interaction. Returns 204 No Content on success. Does not support ephemeral followups.
     * @see https://discord.com/developers/docs/interactions/receiving-and-responding#delete-followup-message
     */
    deleteFollowupMessage(application_id: snowflake, token: string, message_id: snowflake): Promise<void>
  }
}

Internal.define({
  '/interactions/{interaction.id}/{interaction.token}/callback': {
    POST: 'createInteractionResponse',
  },
  '/webhooks/{application.id}/{interaction.token}/messages/@original': {
    GET: 'getOriginalInteractionResponse',
    PATCH: 'editOriginalInteractionResponse',
    DELETE: 'deleteOriginalInteractionResponse',
  },
  '/webhooks/{application.id}/{interaction.token}': {
    POST: 'createFollowupMessage',
  },
  '/webhooks/{application.id}/{interaction.token}/messages/{message.id}': {
    GET: 'getFollowupMessage',
    PATCH: 'editFollowupMessage',
    DELETE: 'deleteFollowupMessage',
  },
})
