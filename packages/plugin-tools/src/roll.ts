import { Context, randomInt } from 'koishi'

export interface RollOptions {
  maxPoint?: number
  maxTimes?: number
}

export function apply (ctx: Context, options: RollOptions = {}) {
  const { maxPoint = 1 << 16, maxTimes = 64 } = options

  ctx.command('tools/roll [expr]', '掷骰')
    .userFields(['name', 'timers'])
    .shortcut('掷骰', { fuzzy: true })
    .example('roll 2d6+d10')
    .action(async ({ session }, message = '1d6') => {
      if (!/^((\d*)d)?(\d+)(\+((\d*)d)?(\d+))*$/i.test(message)) return session.$send('表达式语法错误。')

      const expressions = message.split('+')
      let hasMultiple = false
      let output = `${session.$username} 掷骰：${message.slice(1)}=`
      let total = 0

      for (const expr of expressions) {
        const [_, dice, _times, _max] = /^((\d*)d)?(\d+)$/i.exec(expr)
        const max = +_max
        if (!max || max > maxPoint) {
          return session.$send(`点数必须在 1 到 ${maxPoint} 之间。`)
        }

        if (!dice) {
          output += max + '+'
          total += max
          continue
        }

        const times = +(_times || 1)
        if (!times || times > maxTimes) {
          return session.$send(`次数必须在 1 到 ${maxTimes} 之间。`)
        }

        const values = []
        for (let index = 0; index < times; index += 1) {
          const value = randomInt(max) + 1
          values.push(value)
          total += value
        }
        if (times > 1) hasMultiple = true
        if (times > 1 && expressions.length > 1) {
          output += '('
        }
        output += values.join('+')
        if (times > 1 && expressions.length > 1) {
          output += ')'
        }
        output += '+'
      }

      output = output.slice(0, -1)
      if (hasMultiple || expressions.length > 1) {
        output += '=' + total
      }
      return session.$send(output)
    })
}
