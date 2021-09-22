import { Context } from 'koishi'

const BASE_URL = 'https://oeis.org'

export const name = 'oeis'

export function apply(ctx: Context) {
  ctx.command('tools/oeis <sequence>', '数列查询', { maxUsage: 10 })
    .option('start', '-s <start>  设置起始页码', { fallback: 0 })
    .usage('输入用逗号隔开的数作为要查询的数列的前几项，或者直接输入以 id:A 打头的数列编号。')
    .example('四季酱，oeis 1,2,3,6,11,23,47,106,235')
    .example('四季酱，oeis id:A000055')
    .action(async ({ options, session }, sequence) => {
      const data = await ctx.http.get(`${BASE_URL}/search?fmt=json&q=${sequence}&start=${options.start}`)
      for (const result of data.results) {
        if (result.name.startsWith('Duplicate')) continue
        session.send([
          `${BASE_URL}/A${String(result.number).padStart(6, '0')}`,
          `${result.name}${result.id ? ` (${result.id})` : ''}`,
          result.data,
          ...result.comment,
        ].join('\n'))
      }
    })
}
