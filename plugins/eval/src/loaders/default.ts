import { Script } from 'vm'

export const name = 'default'

let noLocation: boolean

try {
  Reflect.construct(Script, ['}'])
} catch (e) {
  noLocation = e.stack.startsWith('SyntaxError')
}

export function extractScript(expr: string) {
  if (noLocation) {
    const segments = expr.split('}')
    return segments.length > 1 ? segments[0] : null
  }

  try {
    Reflect.construct(Script, [expr])
  } catch (e) {
    if (!(e instanceof Error)) throw e
    if (e.message === "Unexpected token '}'") {
      const eLines = e.stack.split('\n')
      const sLines = expr.split('\n')
      const cap = /\d+$/.exec(eLines[0])
      const row = +cap[0] - 1
      return [...sLines.slice(0, row), sLines[row].slice(0, eLines[2].length - 1)].join('\n')
    }
  }
}

export function transformScript(expr: string) {
  try {
    Reflect.construct(Script, [expr, { filename: 'stdin' }])
    return expr
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw new Error('unknown error encounted')
    if (noLocation) return e.stack.split('\n', 1)[0]
    const lines = e.stack.split('\n', 5)
    throw new Error(`${lines[4]}\n    at ${lines[0]}:${lines[2].length}`)
  }
}

export function transformModule(expr: string) {
  return expr
}
