import { Command, User } from 'koishi-core'

export interface UserTrap<T = any, K extends User.Field = never> {
  fields: Iterable<K>
  get(data: Pick<User, K>): T
}

export namespace UserTrap {
  const traps: Record<string, UserTrap<any, any>> = {}

  export function define<T, K extends User.Field = never>(key: string, trap: UserTrap<T, K>) {
    traps[key] = trap
  }

  export function prepare(cmd: Command, fields: string[]) {
    for (const field of fields) {
      const trap = traps[field]
      cmd.userFields(trap ? trap.fields : [field])
    }
  }

  export function get($user: {}, fields: string[]) {
    const result: Partial<User> = {}
    for (const field of fields) {
      const trap = traps[field]
      Reflect.set(result, field, trap ? trap.get($user) : $user[field])
    }
    return result
  }
}
