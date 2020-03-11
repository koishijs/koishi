import { NextFunction, Command, Meta, Context, UserField, GroupField } from '..'
import { messages } from '../messages'
import { format } from 'util'
import leven from 'leven'

export default function apply (ctx: Context) {
  ctx.middleware((meta, next) => {
    const { message, prefix, nickname } = meta.$parsed
    const target = meta.$parsed.message.split(/\s/, 1)[0].toLowerCase()
    if (!target || !(prefix !== null || nickname || meta.messageType === 'private')) return next()

    const executableMap = new Map<Command, boolean>()
    return showSuggestions({
      target,
      meta,
      next,
      prefix: messages.COMMAND_SUGGESTION_PREFIX,
      suffix: messages.COMMAND_SUGGESTION_SUFFIX,
      items: Object.keys(this._commandMap),
      coefficient: this.options.similarityCoefficient,
      command: suggestion => this._commandMap[suggestion],
      disable: (name) => {
        const command = this._commandMap[name]
        let disabled = executableMap.get(command)
        if (disabled === undefined) {
          disabled = !!command.getConfig('disable', meta)
          executableMap.set(command, disabled)
        }
        return disabled
      },
      execute: async (suggestion, meta, next) => {
        const newMessage = suggestion + message.slice(target.length)
        const argv = this.parseCommandLine(newMessage, meta)
        return argv.command.execute(argv, next)
      },
    })
  })
}

interface SuggestOptions {
  target: string
  items: string[]
  meta: Meta<'message'>
  next: NextFunction
  prefix: string
  suffix: string
  coefficient?: number
  disable?: (name: string) => boolean
  command: Command | ((suggestion: string) => Command)
  execute: (suggestion: string, meta: Meta<'message'>, next: NextFunction) => any
}

export function showSuggestions (options: SuggestOptions): Promise<void> {
  const { target, items, meta, next, prefix, suffix, execute, disable, coefficient = 0.4 } = options
  const suggestions = items.filter((name) => {
    return name.length > 2
      && leven(name, target) <= name.length * coefficient
      && !disable?.(name)
  })
  if (!suggestions.length) return next()

  return next(() => {
    const message = prefix + format(messages.SUGGESTION_TEXT, suggestions.map(name => `“${name}”`).join('或'))
    if (suggestions.length > 1) return meta.$send(message)

    const command = typeof options.command === 'function' ? options.command(suggestions[0]) : options.command
    meta.$argv = { command, meta }
    const userFields = new Set<UserField>(['flag'])
    const groupFields = new Set<GroupField>(['flag', 'assignee'])
    Command.attachUserFields(meta, userFields)
    Command.attachGroupFields(meta, groupFields)
    command.context.onceMiddleware(async (meta, next) => {
      if (meta.message.trim()) return next()
      meta.$user = await command.context.database?.observeUser(meta.userId, Array.from(userFields))
      if (meta.messageType === 'group') {
        meta.$group = await command.context.database?.observeGroup(meta.groupId, Array.from(groupFields))
      }
      return execute(suggestions[0], meta, next)
    }, meta)
    return meta.$send(message + suffix)
  })
}
