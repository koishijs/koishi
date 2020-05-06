import { Context } from 'koishi-core'
import { DialogueFlag } from '../database'
import { TeachConfig } from '../utils'
import { unescapeAnswer, triggerDialogue } from '../receiver'
import { isInteger } from 'koishi-utils'

declare module '../database' {
  interface Dialogue {
    probS: number
    probA: number
  }
}

declare module '../receiver' {
  interface SessionState {
    activated: Record<number, number>
  }
}

export default function apply (ctx: Context, config: TeachConfig) {
  const { maxRedirections = 3 } = config

  ctx.command('teach')
    .option('-r, --redirect', '使用指令重定向')
    .option('-R, --no-redirect', '取消使用指令重定向')
    .option('=>, --redirect-dialogue <answer>', '重定向到其他问答')

  ctx.command('teach/dialogue <message...>', '触发教学对话')
    .option('-g, --group [id]', '设置要触发问答的群号')
    .action(async ({ meta, options, next }, message) => {
      if (meta.$_redirected > maxRedirections) return next()

      if (options.group !== undefined) {
        if (!isInteger(options.group) || options.group <= 0) {
          return meta.$send('选项 -g, --group 应为正整数。')
        }
        meta.groupId = options.group
      }

      if (meta.messageType !== 'group' && !options.group) {
        return meta.$send('请输入要触发问答的群号。')
      }

      meta.message = message
      return triggerDialogue(ctx, meta, next)
    })

  ctx.on('dialogue/validate', ({ options, meta }) => {
    if (options.redirectDialogue) {
      options.redirect = true
      options.answer = 'dialogue ' + options.answer
    } else if (options.redirect && !options.search && options.answer) {
      const [name] = options.answer.split(' ', 1)
      if (!ctx.app._commandMap[name]) {
        return meta.$send('没有重定向到合法的指令。')
      }
    }
  })

  ctx.before('dialogue/modify', ({ options }, data) => {
    if (options.redirect !== undefined) {
      data.flag &= ~DialogueFlag.redirect
      data.flag |= +options.redirect * DialogueFlag.redirect
    }
  })

  ctx.on('dialogue/detail-short', ({ flag }, output) => {
    if (flag & DialogueFlag.redirect) {
      output.answerType = '重定向'
    }
  })

  ctx.on('dialogue/detail', ({ flag, answer }, output) => {
    if (flag & DialogueFlag.redirect) {
      const index = output.findIndex(text => text.startsWith('回答：'))
      if (answer.startsWith('dialogue ')) {
        output[index] = `重定向到问题：${answer.slice(9).trimStart()}`
      } else {
        output[index] = `重定向到指令：${answer}`
      }
    }
  })

  ctx.on('dialogue/before-send', ({ dialogue, meta, answer, next }) => {
    if (dialogue.flag & DialogueFlag.redirect) {
      Object.defineProperty(meta, '$_redirected', {
        writable: true,
        value: (meta.$_redirected || 0) + 1,
      })
      ctx.logger('dialogue').debug(meta.message, '=>', dialogue.answer)
      return ctx.app.executeCommandLine(unescapeAnswer(answer), meta, next)
    }
  })
}
