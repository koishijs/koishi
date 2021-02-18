export interface Segment {
  type: string
  data: Segment.Data
}

export function Segment(type: string, data: Segment.Data = {}) {
  let output = '[CQ:' + type
  for (const key in data) {
    if (data[key]) output += `,${key}=${Segment.escape(data[key], true)}`
  }
  return output + ']'
}

export namespace Segment {
  export type Chain = Segment.Parsed[]
  export type Data = Record<string, string | number | boolean>

  export interface Parsed extends Segment {
    data: Record<string, string>
    capture?: RegExpExecArray
  }

  export function escape(source: any, inline = false) {
    const result = String(source)
      .replace(/&/g, '&amp;')
      .replace(/\[/g, '&#91;')
      .replace(/\]/g, '&#93;')
    return inline
      ? result.replace(/,/g, '&#44;').replace(/(\ud83c[\udf00-\udfff])|(\ud83d[\udc00-\ude4f\ude80-\udeff])|[\u2600-\u2B55]/g, ' ')
      : result
  }

  export function unescape(source: string) {
    return String(source)
      .replace(/&#91;/g, '[')
      .replace(/&#93;/g, ']')
      .replace(/&#44;/g, ',')
      .replace(/&amp;/g, '&')
  }

  export function join(codes: Segment[]) {
    return codes.map(code => Segment(code.type, code.data)).join('')
  }

  export function from(source: string, typeRegExp = '\\w+'): Segment.Parsed {
    const capture = new RegExp(`\\[CQ:(${typeRegExp})((,\\w+=[^,\\]]*)*)\\]`).exec(source)
    if (!capture) return null
    const [, type, attrs] = capture
    const data: Record<string, string> = {}
    attrs.slice(1).split(',').forEach((str) => {
      const index = str.indexOf('=')
      data[str.slice(0, index)] = unescape(str.slice(index + 1))
    })
    return { type, data, capture }
  }

  export function parse(source: string) {
    const chain: Chain = []
    let result: Segment.Parsed
    while ((result = from(source))) {
      const { capture } = result
      if (capture.index) {
        chain.push({ type: 'text', data: { content: source.slice(0, capture.index) } })
      }
      chain.push(result)
      source = source.slice(capture.index + capture[0].length)
    }
    if (source) chain.push({ type: 'text', data: { content: source } })
    return chain
  }
}
