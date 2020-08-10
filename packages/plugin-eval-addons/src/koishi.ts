interface Argv {
  name: string
  args: string[]
  options: Record<string, any>
  rest: string
}

type Action = (argv: Argv) => string | void | Promise<string | void>

const commandMap: Record<string, Action> = {}

export function registerCommand (name: string, callback: Action) {
  commandMap[name] = callback
}

export function executeCommand (argv: Argv) {
  const callback = commandMap[argv.name]
  if (!callback) throw new Error(`cannot find command "${argv.name}"`)
  return callback(argv)
}
