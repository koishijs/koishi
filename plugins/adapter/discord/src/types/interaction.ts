import { AllowedMentions, ApplicationCommandInteractionDataOption, Channel, Component, Embed, GuildMember, integer, Internal, Message, Role, SelectOption, snowflake, User } from '.'

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
  options?: ApplicationCommandInteractionDataOption[]
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
