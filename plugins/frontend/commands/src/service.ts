import { DataSource } from '@koishijs/plugin-console'
import { debounce } from 'throttle-debounce'
import { Command, Context } from 'koishi'

declare module '@koishijs/plugin-console' {
  interface Sources {
    commands: CommandProvider
  }
}

export interface CommandData extends Command.Config {
  name: string
  aliases: string[]
  children: CommandData[]
}

function traverse(command: Command): CommandData {
  return {
    name: command.name,
    aliases: command._aliases,
    children: command.children.map(traverse),
    ...command.config,
  }
}

export default class CommandProvider extends DataSource<CommandData[]> {
  cached: CommandData[]
  update = debounce(0, () => this.broadcast())

  constructor(ctx: Context) {
    super(ctx, 'commands')

    ctx.on('command-added', this.update)
    ctx.on('command-removed', this.update)
    ctx.on('dispose', this.update.cancel)
  }

  async get(forced = false) {
    if (this.cached && !forced) return this.cached
    this.cached = this.ctx.app._commandList.filter(cmd => !cmd.parent).map(traverse)
    return this.cached
  }
}
