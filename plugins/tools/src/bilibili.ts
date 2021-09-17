// modified from https://github.com/Coxxs/bvid

import { Context } from 'koishi'
import axios from 'axios'

const table = 'fZodR9XQDSUm21yCkr6zBqiveYah8bt4xsWpHnJE7jL5VG3guMTKNPAwcF'
const tr = {}
for (let i = 0; i < 58; i++) {
  tr[table[i]] = i
}
const s = [11, 10, 3, 8, 4, 6]
const r = ['B', 'V', '1', '', '', '4', '', '1', '', '7', '', '']
const xor = 177451812
const add = 8728348608

function decode(source: string) {
  if (source.length !== 12 || (source[0] + source[1] + source[2] + source[5] + source[7] + source[9]).toUpperCase() !== r.join('')) {
    return null
  }
  let result = 0
  for (let i = 0; i < 6; i++) {
    result += tr[source[s[i]]] * (58 ** i)
  }
  result = ((result - add) ^ xor)
  return result > 0 && result < 1e9 ? result : null
}

const bvRegExp = /(BV[0-9a-zA-Z]{10})/gmi

const patterns: [RegExp, (this: Context, cap: RegExpExecArray) => Promise<number> | number][] = [
  [bvRegExp, (cap) => decode(cap[1])],
  [/b23\.tv\/([a-zA-Z0-9]+)/gmi, async (cap) => {
    try {
      // this should respond with 302
      await axios.get(`https://b23.tv/${cap[1]}`, { maxRedirects: 0 })
    } catch (err) {
      const cap = bvRegExp.exec(err.response?.headers?.location)
      if (cap) return decode(cap[1])
    }
  }],
]

export const name = 'bilibili'

export function apply(ctx: Context) {
  async function getInfo(id: number) {
    const data = await ctx.http.get(`http://api.bilibili.com/x/web-interface/view?aid=${id}`)
    return `bilibili.com/video/av${id}\n${data.data.title}\n[CQ:image,file=${data.data.pic}]`
  }

  ctx.middleware(async (session, next) => {
    return next(async (next) => {
      for (const [regExp, processor] of patterns) {
        const result = regExp.exec(session.content)
        if (!result) continue
        try {
          const id = await processor.call(ctx, result)
          if (!id) return
          const output = await getInfo(id)
          return session.send(output)
        } catch {
          return // pass
        }
      }
      return next()
    })
  })
}
