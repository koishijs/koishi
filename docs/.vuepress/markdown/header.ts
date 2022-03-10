import { App, Session, Context, Command, Service, Schema, Argv, Awaitable, User, Channel } from 'koishi'
import { Dict, segment } from '@koishijs/utils'
import {} from '@koishijs/plugin-console'
import {} from '@koishijs/plugin-schedule'
import {} from '@koishijs/plugin-teach'

declare const app: App
declare const ctx: Context
declare const cmd: Command
declare const session: Session<User.Field, Channel.Field>

// ---cut---
