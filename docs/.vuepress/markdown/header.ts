import { App, Session, Context, Command, Service, Schema, Argv, Awaitable } from 'koishi'
import { Dict, segment } from '@koishijs/utils'
import {} from '@koishijs/plugin-rate-limit'
import {} from '@koishijs/plugin-console'
import { Schedule } from '@koishijs/plugin-schedule'
import {} from '@koishijs/plugin-teach'
import * as Koishi from 'koishi'

declare const app: App
declare const ctx: Context
declare const cmd: Command
declare const session: Session<Koishi.User.Field, Koishi.Channel.Field>

// ---cut---
