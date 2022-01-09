import { Command, Context, Dict } from 'koishi'

export interface Override extends Command.Config {
  name?: string
}

export const name = 'override'

export function apply(ctx: Context, config: Dict<Override>) {
  const legacy: Dict<Override> = {}

  function override(cmd: Command, config: Override) {
    const { name, ...options } = config
    legacy[cmd.name] = cmd.config
    legacy[cmd.name].name = cmd.name
    Object.assign(cmd.config, options)
    if (!name) return
    cmd.alias(name)
    cmd.name = name
  }

  for (const key in config) {
    const cmd = ctx.app._commands.resolve(key)
    if (cmd) override(cmd, config[key])
  }

  ctx.on('command-added', (cmd) => {
    for (const key in config) {
      if (cmd === ctx.app._commands.resolve(key)) {
        return override(cmd, config[key])
      }
    }
  })

  ctx.on('command-removed', (cmd) => {
    for (const key in config) {
      if (cmd === ctx.app._commands.resolve(key)) {
        return delete legacy[cmd.name]
      }
    }
  })

  ctx.on('dispose', () => {
    for (const key in legacy) {
      const { name, ...options } = legacy[key]
      const cmd = ctx.app._commands.resolve(key)
      Object.assign(cmd.config, options)
      cmd.name = name
    }
  })
}
