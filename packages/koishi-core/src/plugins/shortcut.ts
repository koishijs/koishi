import { Context } from '../context'
import { Command, ParsedLine } from '../command'
import { defineProperty } from 'koishi-utils'

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

export default function apply(ctx: Context) {
  defineProperty(ctx.app, '_shortcuts', [])
  defineProperty(ctx.app, '_shortcutMap', {})

  ctx.on('new-command', (cmd) => {
    cmd._shortcuts = {}
  })

  ctx.on('remove-command', (cmd) => {
    for (const name in cmd._shortcuts) {
      delete ctx.app._shortcutMap[name]
      const index = ctx.app._shortcuts.indexOf(cmd._shortcuts[name])
      ctx.app._shortcuts.splice(index, 1)
    }
  })

  ctx.on('parse', (message, { $reply, $prefix, $appel }, builtin) => {
    if (!builtin || $prefix || $reply) return
    for (const shortcut of ctx.app._shortcuts) {
      const { name, fuzzy, command, oneArg, prefix, options, args = [] } = shortcut
      if (prefix && !$appel) continue
      if (!fuzzy && message !== name) continue
      if (message.startsWith(name)) {
        const _message = message.slice(name.length)
        if (fuzzy && !$appel && _message.match(/^\S/)) continue
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
