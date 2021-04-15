const { compile } = require('coffeescript')
const { transformAsync } = require('@babel/core')

const options = {
  plugins: [
    ['@babel/plugin-transform-react-jsx']
  ]
}

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

export async function transformScript(expr: string) {
  const jsx = compile(expr, { bare: true })
  const js = await transformAsync(jsx, options)
  return js.code
}

export const transformModule = transformScript
