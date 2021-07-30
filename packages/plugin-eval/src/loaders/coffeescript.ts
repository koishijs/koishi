import { compile } from 'coffeescript'
import { transformAsync, TransformOptions } from '@babel/core'
import { LoaderConfig } from '../worker'

export const name = 'coffeescript'

const options: TransformOptions = {
  sourceMaps: 'inline',
  plugins: [],
}

export function prepare(config: LoaderConfig) {
  if (config.jsxFactory) {
    options.plugins.push(['@babel/plugin-transform-react-jsx', {
      pragma: config.jsxFactory,
      pragmaFrag: config.jsxFragment,
      useBuiltIns: true,
      useSpread: true,
    }])
  }
}

export function extractScript(expr: string) {
  try {
    compile(expr)
  } catch (e) {
    if (e.message !== 'unmatched }') throw e
    const location = e.location
    const sLines = expr.split('\n')
    const row = location.first_line
    const column = location.first_column - 1
    return [...sLines.slice(0, row - 1), sLines[row].slice(0, column + 1)].join('\n')
  }
}

export async function transformScript(expr: string) {
  // wrapped by `do` so that we can use `await` in the exporession
  expr = `do -> (${expr})`
  const raw = compile(expr, { bare: true })
  const { code } = await transformAsync(raw, options)
  return code
}

export async function transformModule(expr: string) {
  const raw = compile(expr, { bare: true })
  const { code } = await transformAsync(raw, options)
  return code
}
