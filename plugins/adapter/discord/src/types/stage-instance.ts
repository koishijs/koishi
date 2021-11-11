import { integer, snowflake } from '.'

/** https://discord.com/developers/docs/resources/stage-instance#stage-instance-object-stage-instance-structure */
export interface StageInstance {
  /** The id of this Stage instance */
  id: snowflake
  /** The guild id of the associated Stage channel */
  guild_id: snowflake
  /** The id of the associated Stage channel */
  channel_id: snowflake
  /** The topic of the Stage instance (1-120 characters) */
  topic: string
  /** The privacy level of the Stage instance */
  privacy_level: integer
  /** Whether or not Stage Discovery is disabled */
  discoverable_disabled: boolean
}

export interface StageInstanceCreateEvent extends StageInstance {}

export interface StageInstanceDeleteEvent extends StageInstance {}

export interface StageInstanceUpdateEvent extends StageInstance {}

declare module './gateway' {
  interface GatewayEvents {
    /** stage instance was created */
    STAGE_INSTANCE_CREATE: StageInstanceCreateEvent
    /** stage instance was deleted or closed */
    STAGE_INSTANCE_DELETE: StageInstanceDeleteEvent
    /** stage instance was updated */
    STAGE_INSTANCE_UPDATE: StageInstanceUpdateEvent
  }
}
