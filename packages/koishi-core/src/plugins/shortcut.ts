import { App, ParsedLine, Command } from '..'

declare module '../app' {
  interface App {
    _shortcuts: ShortcutConfig[]
    _shortcutMap: Record<string, Command>
  }
}

declare module '../command' {
  interface Command {
    _shortcuts: Record<string, ShortcutConfig>
    shortcut (name: string, config?: ShortcutConfig): this
  }
}

export interface ShortcutConfig {
  name?: string
  command?: Command
  authority?: number
  hidden?: boolean
  prefix?: boolean
  fuzzy?: boolean
  args?: string[]
  oneArg?: boolean
  options?: Record<string, any>
}

Command.prototype.shortcut = function (this: Command, name, config) {
  config = this._shortcuts[name] = {
    name,
    command: this,
    authority: this.config.authority,
    ...config,
  }
  this.app._shortcutMap[name] = this
  this.app._shortcuts.push(config)
  return this
}

export default function apply (app: App) {
  app._shortcuts = []
  app._shortcutMap = {}

  app.on('new-command', (cmd) => {
    cmd._shortcuts = {}
  })

  app.on('parse', (message, { $parsed }, forced) => {
    if (forced && $parsed.prefix) return
    const nickname = !forced || $parsed.nickname
    for (const shortcut of app._shortcuts) {
      const { name, fuzzy, command, oneArg, prefix, options, args = [] } = shortcut
      if (prefix && !nickname) continue
      if (!fuzzy && message !== name) continue
      if (message.startsWith(name)) {
        const _message = message.slice(name.length)
        if (fuzzy && !nickname && _message.match(/^\S/)) continue
        const result: ParsedLine = oneArg
          ? { options: {}, args: [_message.trim()], rest: '' }
          : command.parse(_message.trim())
        result.options = { ...options, ...result.options }
        result.args.unshift(...args)
        return { command, ...result }
      }
    }
  })
}
