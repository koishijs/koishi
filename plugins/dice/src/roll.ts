import { Context, Random } from 'koishi'

export interface RollConfig {
  maxPoint?: number
  maxTimes?: number
}

export default function apply(ctx: Context, options: RollConfig = {}) {
  const { maxPoint = 1 << 16, maxTimes = 64 } = options
  const regexp = /^((\d*)d)?(\d+)(\+((\d*)d)?(\d+))*$/i

  ctx.command('roll [expr]', '掷骰')
    .userFields(['name', 'timers'])
    .shortcut('掷骰', { fuzzy: true })
    .example('roll 2d6+d10')
    .action(async ({ session }, message = '1d6') => {
      if (!regexp.test(message)) return '表达式语法错误。'

      const expressions = message.split('+')
      let hasMultiple = false
      let output = `${session.username} 掷骰：${message}=`
      let total = 0

      for (const expr of expressions) {
        const [, dice, _times, _max] = /^((\d*)d)?(\d+)$/i.exec(expr)
        const max = +_max
        if (!max || max > maxPoint) {
          return `点数必须在 1 到 ${maxPoint} 之间。`
        }

        if (!dice) {
          output += max + '+'
          total += max
          continue
        }

        const times = +(_times || 1)
        if (!times || times > maxTimes) {
          return `次数必须在 1 到 ${maxTimes} 之间。`
        }

        const values = []
        for (let index = 0; index < times; index += 1) {
          const value = Random.int(max) + 1
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
      return output
    })

  ctx.middleware((session, next) => {
    const { content, prefix } = session.parsed
    if (!prefix || content[0] !== 'r') return next()
    const expr = content.slice(1)
    if (!regexp.test(expr)) return next()
    return session.execute({ name: 'roll', args: [expr] })
  })
}
