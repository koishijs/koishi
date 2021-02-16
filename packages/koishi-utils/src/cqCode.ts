type CQCodeData = Record<string, string | number | boolean>

export interface CQCode {
  type: string
  data: CQCodeData
}

interface ParsedCQCode {
  type: string
  data: Record<string, string>
  capture?: RegExpExecArray
}

export function CQCode(type: string, data: CQCodeData = {}) {
  let output = '[CQ:' + type
  for (const key in data) {
    if (data[key]) output += `,${key}=${CQCode.escape(data[key], true)}`
  }
  return output + ']'
}

export namespace CQCode {
  export type InputChain = (string | CQCode)[]
  export type Chain = (string | ParsedCQCode)[]

  export function escape(source: any, insideCQ = false) {
    const result = String(source)
      .replace(/&/g, '&amp;')
      .replace(/\[/g, '&#91;')
      .replace(/\]/g, '&#93;')
    return insideCQ
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

  export function join(codes: InputChain) {
    return codes.map(code => typeof code === 'string' ? code : CQCode(code.type, code.data)).join('')
  }

  export function find(source: string, typeRegExp = '\\w+'): ParsedCQCode {
    const capture = new RegExp(`\\[CQ:(${typeRegExp})((,\\w+=[^,\\]]*)+)\\]`).exec(source)
    if (!capture) return null
    const [, type, attrs] = capture
    const data: Record<string, string> = {}
    attrs.slice(1).split(',').forEach((str) => {
      const index = str.indexOf('=')
      data[str.slice(0, index)] = unescape(str.slice(index + 1))
    })
    return { type, data, capture }
  }

  export function build(source: string) {
    const chain: Chain = []
    let result: ParsedCQCode
    while ((result = find(source))) {
      const { capture } = result
      if (capture.index) {
        chain.push(source.slice(0, capture.index))
      }
      chain.push(result)
      source = source.slice(capture.index + capture[0].length)
    }
    if (source) chain.push(source)
    return chain
  }

  /** @deprecated */
  export const stringify = CQCode
  /** @deprecated */
  export const stringifyAll = join
  /** @deprecated */
  export const parse = find
  /** @deprecated */
  export const parseAll = build
}
