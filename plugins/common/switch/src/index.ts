import { Context, template, deduplicate, difference, intersection, Argv } from 'koishi'
import { adminChannel } from '@koishijs/command-utils'

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

export interface Config {}

export const name = 'switch'

export function apply(ctx: Context, config: Config = {}) {
  ctx.model.extend('channel', {
    disable: 'list',
  })
  
  ctx.before('attach-channel', (session, fields) => {
    if (session.argv) fields.add('disable')
  })

  // check channel
  ctx.on('command/check', ({ session, command }: Argv<never, 'disable'>) => {
    if (!session.channel) return
    while (command) {
      if (session.channel.disable.includes(command.name)) return ''
      command = command.parent as any
    }
  })

  ctx.command('switch <command...>', '启用和禁用功能', { authority: 3 })
    .channelFields(['disable'])
    .userFields(['authority'])
    .use(adminChannel)
    .action(async ({ session }, ...names: string[]) => {
      const channel = session.channel
      if (!names.length) {
        if (!channel.disable.length) return template('switch.none')
        return template('switch.list', channel.disable.join(', '))
      }

      names = deduplicate(names)
      const forbidden = names.filter((name) => {
        const command = ctx.app._commands.get(name)
        return command && command.config.authority >= session.user.authority
      })
      if (forbidden.length) return template('switch.forbidden', forbidden.join(', '))

      const add = difference(names, channel.disable)
      const remove = intersection(names, channel.disable)
      const preserve = difference(channel.disable, names)
      const output: string[] = []
      if (add.length) output.push(`禁用 ${add.join(', ')} 功能`)
      if (remove.length) output.push(`启用 ${remove.join(', ')} 功能`)
      channel.disable = [...preserve, ...add]
      await channel.$update()
      return `已${output.join('，')}。`
    })
}
