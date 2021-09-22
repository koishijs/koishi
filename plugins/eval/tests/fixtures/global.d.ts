declare module 'koishi/addons' {
  import { User, Channel, Awaitable } from 'koishi'

  interface Argv {
    args: string[]
    options: Record<string, any>
    user: User.Observed
    channel: Channel.Observed
    send(...args: any[]): Promise<void>
    exec(message: string): Promise<void>
  }

  export function registerCommand(name: string, callback: (argv: Argv) => Awaitable<void | string>): void
}

declare module 'koishi/utils' {
  import { Time, Random, segment } from '@koishijs/utils'

  export { Time, Random, segment }
}
