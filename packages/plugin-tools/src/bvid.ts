// modified from https://github.com/Coxxs/bvid
import { Context } from 'koishi'

const table = 'fZodR9XQDSUm21yCkr6zBqiveYah8bt4xsWpHnJE7jL5VG3guMTKNPAwcF'
const tr = {}
for (let i = 0; i < 58; i++) {
  tr[table[i]] = i
}
const s = [11, 10, 3, 8, 4, 6]
const r = ['B', 'V', '1', '', '', '4', '', '1', '', '7', '', '']
const xor = 177451812
const add = 8728348608

function decode (source: string) {
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

function encode (source: number) {
  if (source <= 0 || source >= 1e9) {
    return null
  }
  source = (source ^ xor) + add
  const result = r.slice()
  for (var i = 0; i < 6; i++) {
    result[s[i]] = table[Math.floor(source / 58 ** i) % 58]
  }
  return result.join('')
}

export function apply (ctx: Context) {
  ctx.command('tools/bvid <avid|bvid>', 'av/BV 号转换')
    .action(async ({ session }, source) => {
      if (!source) return session.$send('请输入正确的 av/BV 号。')
      if (source.startsWith('BV')) {
        const result = decode(source)
        if (result) return session.$send('av' + result)
      } else if (/^av\d+$/.test(source)) {
        const result = encode(+source.slice(2))
        if (result) return session.$send(result)
      }
      return session.$send('请输入正确的 av/BV 号。')
    })
}
