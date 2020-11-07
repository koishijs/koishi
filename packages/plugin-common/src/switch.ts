import { Context, ParsedArgv, extendDatabase, Group } from 'koishi-core'
import MysqlDatabase from 'koishi-plugin-mysql'

declare module 'koishi-core/dist/database' {
  export interface Group {
    features: string[]
  }
}

export function apply(ctx: Context) {
  Group.extend(() => ({
    features: [],
  }))

  extendDatabase<typeof MysqlDatabase>('koishi-plugin-mysql', (Database) => {
    Database.listFields.push('group.features')
  })

  ctx.on('before-command', ({ session, command }: ParsedArgv<never, 'features'>) => {
    if (session.$group.features.includes(command.name)) return ''
  })

  ctx.on('before-attach-group', (session, fields) => {
    fields.add('features')
  })

  ctx.group().command('enable <command>', '启用功能', { authority: 3 })
    .userFields(['authority'])
    .groupFields(['features'])
    .action(({ session }, command) => {
      const { features } = session.$group
      if (!features.includes(command)) {
        features.push(command)
      }
      return `${command} 功能已启用。`
    })

  ctx.group().command('disable <command>', '禁用功能', { authority: 3 })
    .userFields(['authority'])
    .groupFields(['features'])
    .action(({ session }, command) => {
      const { features } = session.$group
      const index = features.indexOf(command)
      if (index >= 0) {
        features.splice(index, 1)
      }
      return `${command} 功能已禁用。`
    })
}
