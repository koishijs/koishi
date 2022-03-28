import { App, Session, Context, Command, Service, Schema, User, Channel } from 'koishi'
import {} from '@koishijs/plugin-adapter-discord'
import {} from '@koishijs/plugin-adapter-onebot'
import {} from '@koishijs/plugin-adapter-telegram'
import {} from '@koishijs/plugin-console'
import {} from '@koishijs/plugin-rate-limit'
import { Schedule } from '@koishijs/plugin-schedule'
import {} from '@koishijs/plugin-teach'

declare global {
  type Dict = import('koishi').Dict
  type Awaitable<T> = import('koishi').Awaitable<T>
  type segment = import('koishi').segment
  const segment: typeof import('koishi').segment
  const Time: typeof import('koishi').Time

  const app: App
  const ctx: Context
  const cmd: Command
  const user: User
  const channel: Channel
  const session: Session<User.Field, Channel.Field>
}

// ---cut---
