type CQCodeData = Record<string, string | number>

interface CQCode {
  type: string
  data: CQCodeData
  capture?: RegExpMatchArray
}

namespace CQCode {
  export function escape (source: any, insideCQ = false) {
    const result = String(source)
      .replace(/&/g, '&amp;')
      .replace(/\[/g, '&#91;')
      .replace(/\]/g, '&#93;')
    return insideCQ
      ? result.replace(/,/g, '&#44;').replace(/(\ud83c[\udf00-\udfff])|(\ud83d[\udc00-\ude4f\ude80-\udeff])|[\u2600-\u2B55]/g, ' ')
      : result
  }

  export function unescape (source: string) {
    return String(source)
      .replace(/&#91;/g, '[')
      .replace(/&#93;/g, ']')
      .replace(/&#44;/g, ',')
      .replace(/&amp;/g, '&')
  }

  export function stringify (type: string, data: CQCodeData) {
    if (type === 'text') return '' + data.text
    let output = '[CQ:' + type
    for (const key in data) {
      if (data[key]) output += `,${key}=${escape(data[key], true)}`
    }
    return output + ']'
  }

  export function stringifyAll (codes: CQCode[]) {
    return codes.map(code => stringify(code.type, code.data)).join('')
  }

  const regexp = /\[CQ:(\w+)((,\w+=[^,\]]*)+)\]/

  export function parse (source: string): CQCode {
    const capture = source.match(regexp)
    if (!capture) return null
    const [_, type, attrs] = capture
    const data: Record<string, string | number> = {}
    attrs.slice(1).split(/,/g).forEach((str) => {
      const index = str.indexOf('=')
      data[str.slice(0, index)] = unescape(str.slice(index + 1))
    })
    return { type, data, capture }
  }

  export function parseAll (source: string) {
    const codes: CQCode[] = []
    let result: CQCode
    while ((result = parse(source))) {
      const { capture } = result
      if (capture.index) {
        codes.push({ type: 'text', data: { text: source.slice(0, capture.index) } })
      }
      codes.push(result)
      source = source.slice(capture.index + capture[0].length)
    }
    if (source) codes.push({ type: 'text', data: { text: source } })
    return codes
  }
}

export default CQCode
