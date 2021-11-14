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
  target_type?: integer
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
  stage_instance?: InviteStageInstance
}

/** https://discord.com/developers/docs/resources/invite#invite-object-invite-target-types */
export enum InviteTargetType {
  STREAM = 1,
  EMBEDDED_APPLICATION = 2,
}

/** https://discord.com/developers/docs/resources/invite#invite-metadata-object-invite-metadata-structure */
export interface InviteMetadata {
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
export interface InviteStageInstance {
  /** the members speaking in the Stage */
  members: Partial<GuildMember>[]
  /** the number of users in the Stage */
  participant_count: integer
  /** the number of users speaking in the Stage */
  speaker_count: integer
  /** the topic of the Stage instance (1-120 characters) */
  topic: string
}

/** https://discord.com/developers/docs/topics/gateway#invite-create-invite-create-event-fields */
export interface InviteCreateEvent {
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
export interface InviteDeleteEvent {
  /** the channel of the invite */
  channel_id: snowflake
  /** the guild of the invite */
  guild_id?: snowflake
  /** the unique invite code */
  code: string
}

declare module './gateway' {
  interface GatewayEvents {
    /** invite to a channel was created */
    INVITE_CREATE: InviteCreateEvent
    /** invite to a channel was deleted */
    INVITE_DELETE: InviteDeleteEvent
  }
}

export interface GetInviteOptions {
  /** whether to include invite metadata */
  with_counts?: boolean
  /** whether to include invite expiration date */
  with_expiration?: boolean
}

declare module './internal' {
  interface Internal {
    /** https://discord.com/developers/docs/resources/invite#get-invite */
    getInvite(code: string, options?: GetInviteOptions): Promise<Invite>
    /** https://discord.com/developers/docs/resources/invite#delete-invite */
    deleteInvite(code: string): Promise<Invite>
  }
}

Internal.define({
  '/invites/{invite.code}': {
    GET: 'getInvite',
    DELETE: 'deleteInvite',
  },
})
