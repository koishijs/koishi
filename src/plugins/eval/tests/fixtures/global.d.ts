declare module 'koishi/addons' {
  import { User, Channel } from 'koishi-core'

  interface Argv {
    args: string[]
    options: Record<string, any>
    user: User.Observed
    channel: Channel.Observed
    send(...args: any[]): Promise<void>
    exec(message: string): Promise<void>
  }

  export function registerCommand(name: string, callback: (argv: Argv) => void | string | Promise<void | string>): void
}

declare module 'koishi/utils' {
  import { Time, Random, segment } from 'koishi-utils'

  export { Time, Random, segment }
}
