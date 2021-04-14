const { compile } = require('coffeescript')

export function extractScript(expr: string) {
  try {
    compile(expr)
  } catch (e) {
    if (e.message !== "unmatched }") throw e
    const location = e.location
    const sLines = expr.split('\n')
    const row = location.first_line
    const column = location.first_column - 1
    return [...sLines.slice(0, row - 1), sLines[row].slice(0, column + 1)].join('\n')
  }
}

export function transformScript(expr: string) {
  try {
    return compile(expr, {bare: true})
  } catch (e) {
    if (e.name !== 'SyntaxError') throw new Error('unknown error encounted')
    throw e
  }
}

export const transformModule = transformScript
