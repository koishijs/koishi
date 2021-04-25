import { transformSync, transform, Message, TransformOptions } from 'esbuild'
import { LoaderConfig } from '../worker'

export const name = 'typescript'

const options: TransformOptions = {
  sourcemap: 'inline',
  loader: 'ts',
  charset: 'utf8',
  target: 'es2020',
}

export function prepare(config: LoaderConfig) {
  if (config.jsxFactory) options.loader = 'tsx'
  options.jsxFactory = config.jsxFactory
  options.jsxFragment = config.jsxFragment
}

export function extractScript(expr: string) {
  try {
    transformSync(expr, options)
  } catch (e) {
    const [{ location, text }] = e.errors as Message[]
    if (text === 'Unexpected "}"') {
      const sLines = expr.split('\n')
      return [...sLines.slice(0, location.line - 1), location.lineText.slice(0, location.column)].join('\n')
    }
  }
}

export async function transformScript(expr: string) {
  try {
    const { code } = await transform(expr, options)
    return code
  } catch (e) {
    const [{ location, text }] = e.errors as Message[]
    throw new Error(`${text}\n    at stdin:${location.line}:${location.column}`)
  }
}

export const transformModule = transformScript
