import { Command, Context, Dict, pick, remove, Schema } from 'koishi'
// import CommandProvider from './service'

export * from './service'

export interface Override {
  name?: string
  alias?: string[]
  create?: boolean
}

export const Override: Schema<Override> = Schema.object({
  name: Schema.string(),
  alias: Schema.array(String),
  create: Schema.boolean(),
})

interface Snapshot extends Command.Config {
  name: string
  parent: Command
}

interface Config extends Override, Command.Config {}

const Config: Schema<string | Config, Config> = Schema.union([
  Schema.intersect([Override, Command.Config]),
  Schema.transform(String, (name) => ({ name, alias: [] })),
])

export const schema: Schema<Dict<string | Config>, Dict<Config>> = Schema.dict(Config)

export const name = 'commands'

export function apply(ctx: Context, config: Dict<Config>) {
  const snapshots: Dict<Snapshot> = {}

  function teleport(command: Command, parent: Command = null) {
    if (command.parent === parent) return
    if (command.parent) {
      remove(command.parent.children, command)
    }
    command.parent = parent
    parent?.children.push(command)
  }

  function locate(command: Command, name: string) {
    const capture = name.match(/.*(?=[./])/)
    if (!capture) return name
    const parent = ctx.app.$commander.resolve(capture[0])
    if (capture[0] && !parent) {
      ctx.logger('command').warn('cannot find parent command', capture[0])
      return
    }
    teleport(command, parent)
    const rest = name.slice(capture[0].length)
    return rest[0] === '.' ? name : rest.slice(1)
  }

  function patch(target: Command) {
    const command: Command = Object.create(target)
    command._disposables = ctx.state.disposables
    return command
  }

  function accept(target: Command, config: Config) {
    const { name, create, ...options } = config
    const command = create ? target : patch(target)

    const snapshot: Snapshot = pick(target, ['name', 'parent'])
    for (const key in options) {
      snapshot[key] = command.config[key]
      command.config[key] = options[key]
    }

    if (name) {
      const _name = locate(target, name)
      if (!_name) return
      // directly modify name of prototype
      command.displayName = _name
    }

    for (const name of config.alias) {
      command.alias(name)
    }

    // save snapshot
    snapshots[target.name] = snapshot
  }

  for (const key in config) {
    const command = ctx.app.$commander.resolve(key)
    if (command) {
      accept(command, config[key])
    } else if (config[key].create) {
      const command = ctx.command(key)
      accept(command, config[key])
    }
  }

  ctx.on('command-added', (cmd) => {
    for (const key in config) {
      if (cmd === ctx.app.$commander.resolve(key)) {
        return accept(cmd, config[key])
      }
    }
  })

  ctx.on('command-removed', (cmd) => {
    delete snapshots[cmd.name]
  })

  ctx.on('dispose', () => {
    for (const key in snapshots) {
      const { name, parent, ...options } = snapshots[key]
      const cmd = ctx.app.$commander.resolve(name)
      Object.assign(cmd.config, options)
      teleport(cmd, parent)
    }
  }, true)

  // ctx.plugin(CommandProvider)
}
