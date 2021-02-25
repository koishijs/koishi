import { AuthorInfo, MessageBase } from 'koishi-core'

type WSEventType =
  | 'READY'
  | 'RESUMED'
  | 'GUILD_CREATE'
  | 'GUILD_DELETE'
  | 'GUILD_UPDATE'
  | 'INVITE_CREATE'
  | 'INVITE_DELETE'
  | 'GUILD_MEMBER_ADD'
  | 'GUILD_MEMBER_REMOVE'
  | 'GUILD_MEMBER_UPDATE'
  | 'GUILD_MEMBERS_CHUNK'
  | 'GUILD_ROLE_CREATE'
  | 'GUILD_ROLE_DELETE'
  | 'GUILD_ROLE_UPDATE'
  | 'GUILD_BAN_ADD'
  | 'GUILD_BAN_REMOVE'
  | 'GUILD_EMOJIS_UPDATE'
  | 'GUILD_INTEGRATIONS_UPDATE'
  | 'CHANNEL_CREATE'
  | 'CHANNEL_DELETE'
  | 'CHANNEL_UPDATE'
  | 'CHANNEL_PINS_UPDATE'
  | 'MESSAGE_CREATE'
  | 'MESSAGE_DELETE'
  | 'MESSAGE_UPDATE'
  | 'MESSAGE_DELETE_BULK'
  | 'MESSAGE_REACTION_ADD'
  | 'MESSAGE_REACTION_REMOVE'
  | 'MESSAGE_REACTION_REMOVE_ALL'
  | 'MESSAGE_REACTION_REMOVE_EMOJI'
  | 'USER_UPDATE'
  | 'PRESENCE_UPDATE'
  | 'TYPING_START'
  | 'VOICE_STATE_UPDATE'
  | 'VOICE_SERVER_UPDATE'
  | 'WEBHOOKS_UPDATE';

export type Payload = {
  op: Opcode;
  d?: any;
  t?: WSEventType;
  s?: number;
}

export interface Author {
  username: string;
  id: string;
  avatar: string;
  public_flags: number;
  discriminator: string;
}

export interface MessageCreateBody {
  guild_id: string;
  content: string;
  author: Author
  id: string;
  timestamp: string;
  channel_id: string
}

export interface User {
  id: string;
  username: string;
  bot?: boolean;
  avatar: string | null;
}

export interface Self extends User {

}

export enum Opcode {
  Hello = 10, Identify = 2, Dispatch = 0, HeartbeatACK = 11, Heartbeat = 1
}
