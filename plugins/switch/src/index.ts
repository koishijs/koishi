import { Command, Context, template, deduplicate, difference, intersection, Argv, Tables } from 'koishi'
import {} from '@koishijs/plugin-admin'

declare module 'koishi' {
  interface Channel {
    disable: string[]
  }

  interface Modules {
    switch: typeof import('.')
  }
}

template.set('switch', {
  'forbidden': '您无权修改 {0} 功能。',
  'list': '当前禁用的功能有：{0}',
  'none': '当前没有禁用功能。',
})

Tables.extend('channel', {
  disable: 'list',
})

Command.channelFields(['disable'])

export interface Config {}

export const name = 'switch'

export function apply(ctx: Context, config: Config = {}) {
  // check channel
  ctx.before('command', ({ session, command }: Argv<never, 'disable'>) => {
    if (!session.channel) return
    while (command) {
      if (session.channel.disable.includes(command.name)) return ''
      command = command.parent as any
    }
  })

  ctx.command('switch <command...>', '启用和禁用功能', { authority: 3 })
    .channelFields(['disable'])
    .userFields(['authority'])
    .adminChannel(async ({ session, target }, ...names: string[]) => {
      if (!names.length) {
        if (!target.disable.length) return template('switch.none')
        return template('switch.list', target.disable.join(', '))
      }

      names = deduplicate(names)
      const forbidden = names.filter((name) => {
        const command = ctx.app._commands.get(name)
        return command && command.config.authority >= session.user.authority
      })
      if (forbidden.length) return template('switch.forbidden', forbidden.join(', '))

      const add = difference(names, target.disable)
      const remove = intersection(names, target.disable)
      const preserve = difference(target.disable, names)
      const output: string[] = []
      if (add.length) output.push(`禁用 ${add.join(', ')} 功能`)
      if (remove.length) output.push(`启用 ${remove.join(', ')} 功能`)
      target.disable = [...preserve, ...add]
      await target.$update()
      return `已${output.join('，')}。`
    })
}
