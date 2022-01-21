import { integer, Internal, snowflake } from '.'

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

export namespace StageInstance {
  export namespace Event {
    export interface Create extends StageInstance {}

    export interface Delete extends StageInstance {}

    export interface Update extends StageInstance {}
  }

  export namespace Params {
    /** https://discord.com/developers/docs/resources/stage-instance#create-stage-instance-json-params */
    export interface Create {
      /** The id of the Stage channel */
      channel_id: snowflake
      /** The topic of the Stage instance (1-120 characters) */
      topic: string
      /** The privacy level of the Stage instance (default GUILD_ONLY) */
      privacy_level?: integer
    }

    /** https://discord.com/developers/docs/resources/stage-instance#modify-stage-instance-json-params */
    export interface Modify {
      /** The topic of the Stage instance (1-120 characters) */
      topic?: string
      /** The privacy level of the Stage instance */
      privacy_level?: integer
    }
  }
}

declare module './gateway' {
  interface GatewayEvents {
    /** stage instance was created */
    STAGE_INSTANCE_CREATE: StageInstance.Event.Create
    /** stage instance was deleted or closed */
    STAGE_INSTANCE_DELETE: StageInstance.Event.Delete
    /** stage instance was updated */
    STAGE_INSTANCE_UPDATE: StageInstance.Event.Update
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Creates a new Stage instance associated to a Stage channel.
     * @see https://discord.com/developers/docs/resources/stage-instance#create-stage-instance
     */
    createStageInstance(params: StageInstance.Params.Create): Promise<StageInstance>
    /**
     * Gets the stage instance associated with the Stage channel, if it exists.
     * @see https://discord.com/developers/docs/resources/stage-instance#get-stage-instance
     */
    getStageInstance(channel_id: snowflake): Promise<StageInstance>
    /**
     * Updates fields of an existing Stage instance.
     * @see https://discord.com/developers/docs/resources/stage-instance#modify-stage-instance
     */
    modifyStageInstance(channel_id: snowflake, params: StageInstance.Params.Modify): Promise<StageInstance>
    /**
     * Deletes the Stage instance.
     * @see https://discord.com/developers/docs/resources/stage-instance#delete-stage-instance
     */
    deleteStageInstance(channel_id: snowflake): Promise<void>
  }
}

Internal.define({
  '/stage-instances': {
    POST: 'createStageInstance',
  },
  '/stage-instances/{channel.id}': {
    GET: 'getStageInstance',
    PATCH: 'modifyStageInstance',
    DELETE: 'deleteStageInstance',
  },
})
