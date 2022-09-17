import { Argv, Context, deduplicate, difference, intersection, Schema } from 'koishi'
import { adminChannel } from '@koishijs/helpers'
import zh from './locales/zh.yml'

declare module 'koishi' {
  namespace Command {
    interface Config {
      disabled?: boolean
    }
  }

  interface Channel {
    enable: string[]
    disable: string[]
  }
}

export interface Config {}

export const name = 'switch'
export const using = ['database'] as const
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context, config: Config = {}) {
  ctx.i18n.define('zh', zh)

  ctx.model.extend('channel', {
    // enable: 'list',
    disable: 'list',
  })

  ctx.before('attach-channel', (session, fields) => {
    if (!session.argv) return
    // fields.add('enable')
    fields.add('disable')
  })

  // check channel
  ctx.before('command/execute', ({ session, command }: Argv<never, 'enable' | 'disable'>) => {
    const { enable = [], disable = [] } = session.channel || {}
    while (command) {
      if (command.config.disabled) {
        if (enable.includes(command.name)) return null
        return ''
      } else {
        if (disable.includes(command.name)) return ''
        command = command.parent as any
      }
    }
  })

  ctx.command('switch <command...>', '启用和禁用功能', { authority: 3 })
    .channelFields(['disable'])
    .userFields(['authority'])
    .use(adminChannel)
    .action(async ({ session }, ...names: string[]) => {
      const channel = session.channel
      if (!names.length) {
        if (!channel.disable.length) return session.text('.none')
        return session.text('.list', [channel.disable.join(', ')])
      }

      names = deduplicate(names)
      const forbidden = names.filter((name) => {
        const command = ctx.$commander._commands.get(name)
        return command && command.config.authority >= session.user.authority
      })
      if (forbidden.length) return session.text('.forbidden', [forbidden.join(', ')])

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
