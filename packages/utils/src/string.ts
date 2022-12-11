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
  let result = '', hasMatch = false
  while ((capture = pattern.exec(template))) {
    if (!hasMatch && capture[0] === template) {
      return evaluate(context, capture[1])
    }
    hasMatch = true
    result += template.slice(0, capture.index)
    result += evaluate(context, capture[1]) ?? ''
    template = template.slice(pattern.lastIndex)
  }
  return result + template
}

export function escapeRegExp(source: string) {
  return source
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    .replace(/-/g, '\\x2d')
}
