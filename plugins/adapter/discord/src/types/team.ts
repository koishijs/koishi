import { snowflake, User } from '.'

/** https://discord.com/developers/docs/topics/teams#data-models-team-object */
export interface Team {
  /** a hash of the image of the team's icon */
  icon?: string
  /** the unique id of the team */
  id: snowflake
  /** the members of the team */
  members: TeamMember[]
  /** the name of the team */
  name: string
  /** the user id of the current team owner */
  owner_user_id: snowflake
}

/** https://discord.com/developers/docs/topics/teams#data-models-team-member-object */
export interface TeamMember {
  /** the user's membership state on the team */
  membership_state: MembershipState
  /** will always be ["*"] */
  permissions: string[]
  /** the id of the parent team of which they are a member */
  team_id: snowflake
  /** the avatar, discriminator, id, and username of the user */
  user: Partial<User>
}

/** https://discord.com/developers/docs/topics/teams#data-models-membership-state-enum */
export enum MembershipState {
  INVITED = 1,
  ACCEPTED = 2,
}
