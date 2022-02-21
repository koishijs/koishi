type Dict<T = any> = { [key: string]: T }
type Awaitable<T> = [T] extends [Promise<unknown>] ? T : T | Promise<T>

type Global = NodeJS.Global & Window & typeof globalThis

type GlobalClass = {
  [K in keyof Global]: Global[K] extends new (...args: any[]) => infer T ? T : never
}

const root: any = typeof self !== 'undefined' ? self : global

function isType<K extends keyof GlobalClass>(type: K, value: any): value is GlobalClass[K] {
  return type in root && value instanceof root[type]
    || Object.prototype.toString.call(value).slice(8, -1) === type
}

// eslint-disable-next-line @typescript-eslint/naming-convention
interface segment {
  type: string
  data: segment.Data
}

function segment(type: string, data: segment.Data = {}) {
  if (type === 'text') return segment.escape(String(data.content))
  let output = '[CQ:' + type
  for (const key in data) {
    if (data[key]) output += `,${key}=${segment.escape(data[key], true)}`
  }
  return output + ']'
}

// eslint-disable-next-line @typescript-eslint/naming-convention
type primitive = string | number | boolean

namespace segment {
  export type Chain = segment.Parsed[]
  export type Data = Dict<primitive>
  export type Transformer = string | ((data: Dict<string>, index: number, chain: Chain) => string)
  export type AsyncTransformer = string | ((data: Dict<string>, index: number, chain: Chain) => Awaitable<string>)

  export interface Parsed extends segment {
    data: Dict<string>
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

  export function join(chain: segment[]) {
    return chain.map(node => segment(node.type, node.data)).join('')
  }

  export interface FindOptions {
    type?: string
    caret?: boolean
  }

  export function from(source: string, options: FindOptions = {}): segment.Parsed {
    let regExpSource = `\\[CQ:(${options.type || '\\w+'})((,\\w+=[^,\\]]*)*)\\]`
    if (options.caret) regExpSource = '^' + regExpSource
    const capture = new RegExp(regExpSource).exec(source)
    if (!capture) return null
    const [, type, attrs] = capture
    const data: Dict<string> = {}
    attrs && attrs.slice(1).split(',').forEach((str) => {
      const index = str.indexOf('=')
      data[str.slice(0, index)] = unescape(str.slice(index + 1))
    })
    return { type, data, capture }
  }

  export function parse(source: string) {
    const chain: Chain = []
    let result: segment.Parsed
    while ((result = from(source))) {
      const { capture } = result
      if (capture.index) {
        chain.push({ type: 'text', data: { content: unescape(source.slice(0, capture.index)) } })
      }
      chain.push(result)
      source = source.slice(capture.index + capture[0].length)
    }
    if (source) chain.push({ type: 'text', data: { content: unescape(source) } })
    return chain
  }

  export function transform(source: string | Chain, rules: Dict<Transformer>, dropOthers = false) {
    const chain = typeof source === 'string' ? parse(source) : source
    return chain.map(({ type, data, capture }, index, chain) => {
      const transformer = rules[type]
      if (typeof transformer === 'string') return transformer
      if (typeof transformer === 'function') return transformer(data, index, chain)
      if (dropOthers) return ''
      if (capture && type !== 'text') return capture[0]
      return segment(type, data)
    }).join('')
  }

  export async function transformAsync(source: string | Chain, rules: Dict<AsyncTransformer>) {
    const chain = typeof source === 'string' ? parse(source) : source
    const cache = new Map<Parsed, string>()
    await Promise.all(chain.map(async (node, index, chain) => {
      const transformer = rules[node.type]
      if (!transformer) return
      cache.set(node, typeof transformer === 'string' ? transformer : await transformer(node.data, index, chain))
    }))
    return chain.map(node => cache.get(node) || segment(node.type, node.data)).join('')
  }

  export type Factory<T> = (value: T, data?: segment.Data) => string

  function createFactory(type: string, key: string): Factory<primitive> {
    return (value, data = {}) => segment(type, { ...data, [key]: value })
  }

  function createAssetFactory(type: string): Factory<string | Buffer | ArrayBuffer> {
    return (value, data = {}) => {
      if (isType('Buffer', value)) {
        value = 'base64://' + value.toString('base64')
      } else if (isType('ArrayBuffer', value)) {
        value = 'base64://' + Buffer.from(value).toString('base64')
      }
      return segment(type, { ...data, url: value })
    }
  }

  export const at = createFactory('at', 'id')
  export const sharp = createFactory('sharp', 'id')
  export const quote = createFactory('quote', 'id')
  export const image = createAssetFactory('image')
  export const video = createAssetFactory('video')
  export const audio = createAssetFactory('audio')
  export const file = createAssetFactory('file')
}

export default segment
