import { onApp, ParsedLine } from '..'

onApp((app) => {
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
          ? { rest: '', options: {}, unknown: [], args: [_message.trim()] }
          : command.parse(_message.trim())
        result.options = { ...options, ...result.options }
        result.args.unshift(...args)
        return { command, ...result }
      }
    }
  })
})
