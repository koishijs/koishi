import { Context, deduplicate, Dict, difference, intersection, Plugin, Schema, Session, template } from 'koishi'
import { adminChannel } from '@koishijs/helpers'

declare module 'koishi' {
  interface Channel {
    disable: string[]
  }
}

template.set('switch', {
  'forbidden': '您无权修改 {0} 功能。',
  'list': '当前禁用的功能有：{0}',
  'none': '当前没有禁用功能。',
})

export interface Config {}

export const name = 'switch'
export const using = ['database'] as const
export const Config: Schema<Config> = Schema.object({})

const kSwitch = Symbol('switch')

class Switch {
  states: Set<Plugin.State> = new Set()
  disabled: string[] = []

  register(state: Plugin.State) {
    if (this.states.has(state)) return
    this.states.add(state)
    const oldFilter = state.context.filter
    state.context[kSwitch] = oldFilter
    state.context.filter = (session: Session<never, 'disable'>) => {
      if (!oldFilter(session)) return false
      if (!session.channel?.disable) return true
      return !session.channel.disable.includes(state.plugin.name)
    }
  }

  unregister(state: Plugin.State) {
    this.states.delete(state)
    state.context.filter = state.context[kSwitch]
  }

  dispose() {
    for (const state of this.states) {
      state.context.filter = state.context[kSwitch]
    }
  }
}

export function apply(ctx: Context, config: Config = {}) {
  ctx.model.extend('channel', {
    disable: 'list',
  })

  ctx.before('attach-channel', (session, fields) => {
    if (!session.argv) return
    fields.add('disable')
  })

  const states: Dict<Switch> = {}

  for (const state of ctx.app.registry.values()) {
    register(state)
  }

  function register(state: Plugin.State) {
    if (!state.plugin?.name || state.plugin.name === 'apply') return
    (states[state.plugin.name] ??= new Switch()).register(state)
  }

  function unregister(state: Plugin.State) {
    if (!state.plugin?.name || state.plugin.name === 'apply') return
    states[state.plugin.name]?.unregister(state)
  }

  ctx.on('plugin-added', register)
  ctx.on('plugin-removed', unregister)

  ctx.on('ready', async () => {
    const channels = await ctx.database.get('channel', {}, ['id', 'platform', 'disable'])
    for (const { id, platform, disable } of channels) {
      for (const name of disable) {
        (states[name] ??= new Switch()).disabled.push(`${platform}:${id}`)
      }
    }
  })

  ctx.on('dispose', () => {
    for (const name in states) {
      states[name].dispose()
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
