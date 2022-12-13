// eslint-disable-next-line no-new-func
const evaluate = new Function('context', 'expr', `
  try {
    with (context) {
      return eval(expr)
    }
  } catch {}
`) as ((context: object, expr: string) => any)

export function interpolate(template: string, context: object, pattern = /\{\{([\s\S]+?)\}\}/g) {
  let capture: RegExpExecArray
  let result = '', lastIndex = 0
  while ((capture = pattern.exec(template))) {
    if (capture[0] === template) {
      return evaluate(context, capture[1])
    }
    result += template.slice(lastIndex, capture.index)
    result += evaluate(context, capture[1]) ?? ''
    lastIndex = capture.index + capture[0].length
  }
  return result + template.slice(lastIndex)
}

export function escapeRegExp(source: string) {
  return source
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    .replace(/-/g, '\\x2d')
}
