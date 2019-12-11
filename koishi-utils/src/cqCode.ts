interface CQCode {
  type: string
  data: Record<string, string | number>
}

namespace CQCode {
  export function escape (source: string, insideCQ = false) {
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
      .replace(/&amp;/g, '&')
      .replace(/&#91;/g, '[')
      .replace(/&#93;/g, ']')
      .replace(/&#44;/g, ',')
  }

  export function stringify (type: string, data: Record<string, any>) {
    let output = '[CQ:' + type
    for (const key in data) {
      if (data[key]) output += `,${key}=${escape(data[key], true)}`
    }
    return output + ']'
  }

  const regexp = /\[CQ:(\w+)((,\w+=[^,\]]*)+)\]/

  export function parse (source: string) {
    const result = source.match(regexp)
    if (!result) return null
    const [_, type, attrs] = result
    const data: Record<string, string | number> = {}
    attrs.slice(1).split(/,/g).forEach((str) => {
      const [_, key, value] = str.match(/^(\w+)=(.+)$/)
      data[key] = unescape(value)
    })
    return { type, data }
  }
}

export default CQCode
