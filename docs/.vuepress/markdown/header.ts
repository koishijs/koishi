import { resolve } from 'path'
import { App, Session, Context, Command, Service, Schema, Argv, Awaitable } from 'koishi'
import { Dict, segment } from '@koishijs/utils'

declare const app: App
declare const ctx: Context
declare const cmd: Command
declare const session: Session

// ---cut---
