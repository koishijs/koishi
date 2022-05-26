import { DataService } from '@koishijs/plugin-console'
import { debounce } from 'throttle-debounce'
import { Command, Context } from 'koishi'
import { resolve } from 'path'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      commands: CommandProvider
    }
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

export default class CommandProvider extends DataService<CommandData[]> {
  static using = ['console'] as const

  cached: CommandData[]
  update = debounce(0, () => this.refresh())

  constructor(ctx: Context) {
    super(ctx, 'commands', { authority: 4 })

    ctx.on('command-added', this.update)
    ctx.on('command-removed', this.update)
    ctx.on('dispose', this.update.cancel)

    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })
  }

  async get(forced = false) {
    if (this.cached && !forced) return this.cached
    this.cached = this.ctx.app.$commander._commandList.filter(cmd => !cmd.parent).map(traverse)
    return this.cached
  }
}
