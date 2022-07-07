// eslint-disable-next-line no-new-func
export const interpolate = new Function('template', 'context', 'pattern', `
  return template.replace(pattern || /\\{\\{([\\s\\S]+?)\\}\\}/g, (_, expr) => {
    try {
      with (context) {
        const result = eval(expr)
        return result === undefined ? '' : result
      }
    } catch {
      return ''
    }
  })
`) as ((template: string, context: object, pattern?: RegExp) => string)

export function escapeRegExp(source: string) {
  return source
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    .replace(/-/g, '\\x2d')
}
