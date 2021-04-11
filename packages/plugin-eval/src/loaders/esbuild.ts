import esbuild from 'esbuild'

export async function transform(expr: string) {
  try {
    const { code } = await esbuild.transform(expr, {
      sourcemap: 'inline',
      loader: 'ts',
      charset: 'utf8',
      target: 'es2020',
    })
    return code
  } catch (e) {
    const [{ location, text }] = e.errors as esbuild.Message[]
    throw new Error(`${text}\n    at stdin:${location.line}:${location.column}`)
  }
}

export function extract(expr: string) {
  try {
    esbuild.transformSync(expr, {
      loader: 'ts',
      charset: 'utf8',
      target: 'es2020',
    })
  } catch (e) {
    const [{ location, text }] = e.errors as esbuild.Message[]
    if (text === 'Unexpected "}"') {
      const sLines = expr.split('\n')
      return [...sLines.slice(0, location.line - 1), location.lineText.slice(0, location.column)].join('\n')
    }
  }
}
