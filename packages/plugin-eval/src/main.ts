import { App, Command, CommandAction, ParsedArgv, User } from 'koishi-core'

interface TrappedArgv<O> extends ParsedArgv<never, never, O> {
  user: Partial<User>
  writable: User.Field[]
}

type TrappedAction<O> = (argv: TrappedArgv<O>, ...args: string[]) => ReturnType<CommandAction>

export interface UserTrap<T = any, K extends User.Field = never> {
  fields: Iterable<K>
  get(data: Pick<User, K>): T
  set(data: Pick<User, K>, value: T): void
}

export namespace UserTrap {
  const traps: Record<string, UserTrap<any, any>> = {}

  export function define<T, K extends User.Field = never>(key: string, trap: UserTrap<T, K>) {
    traps[key] = trap
  }

  export function attach<O>(command: Command<never, never, O>, fields: Access<User.Field>, action: TrappedAction<O>) {
    const { readable = [], writable = [] } = Array.isArray(fields) ? { readable: fields } : fields
    for (const field of readable) {
      const trap = traps[field]
      command.userFields(trap ? trap.fields : [field])
      command.action((argv, ...args) => {
        const user = get(argv.session.$user, readable)
        return action({ ...argv, user, writable }, ...args)
      })
    }
  }

  export function get($user: User.Observed<never>, fields: string[]) {
    if (!$user) return {}
    const result: Partial<User> = {}
    for (const field of fields) {
      const trap = traps[field]
      Reflect.set(result, field, trap ? trap.get($user) : $user[field])
    }
    return result
  }

  export function set($user: User.Observed<never>, data: Partial<User>) {
    for (const field in data) {
      const trap = traps[field]
      trap ? trap.set($user, data[field]) : $user[field] = data[field]
    }
    return $user._update()
  }
}

export type Access<T> = T[] | {
  readable?: T[]
  writable?: T[]
}

export class MainAPI {
  constructor(public app: App) {}

  private getSession(uuid: string) {
    const session = this.app._sessions[uuid]
    if (!session) throw new Error(`session ${uuid} not found`)
    return session
  }

  async execute(uuid: string, message: string) {
    const session = this.getSession(uuid)
    const send = session.$send
    const sendQueued = session.$sendQueued
    await session.$execute(message)
    session.$sendQueued = sendQueued
    session.$send = send
  }

  async send(uuid: string, message: string) {
    const session = this.getSession(uuid)
    if (!session._sendCount) session._sendCount = 0
    if (this.app.evalConfig.maxLogs > session._sendCount++) {
      return await session.$sendQueued(message)
    }
  }

  async updateUser(uuid: string, data: Partial<User>) {
    const session = this.getSession(uuid)
    return UserTrap.set(session.$user, data)
  }
}
