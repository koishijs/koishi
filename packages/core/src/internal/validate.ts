import { Argv } from '../parser'
import { Context } from '../context'

export type ValidationField = 'authority' | 'usage' | 'timers'

export default function validate(ctx: Context) {
  // add user fields
  ctx.on('command-added', (cmd) => {
    cmd.userFields(({ tokens, command, options = {} }, fields) => {
      if (!command) return
      const { authority } = command.config
      let shouldFetchAuthority = authority > 0
      for (const { name, authority } of Object.values(command._options)) {
        if (name in options) {
          if (authority > 0) shouldFetchAuthority = true
        } else if (tokens) {
          if (authority > 0) shouldFetchAuthority = true
        }
      }
      if (shouldFetchAuthority) fields.add('authority')
    })
  })

  // check user
  ctx.before('command/execute', (argv: Argv<'authority'>) => {
    const { session, options, command } = argv
    if (!session.user) return

    function sendHint(message: string, ...param: any[]) {
      return command.config.showWarning ? session.text(message, param) : ''
    }

    // check authority
    if (session.user.authority) {
      const authority = command.getConfig('authority', session)
      if (authority > session.user.authority) {
        return sendHint('internal.low-authority')
      }
    }
    for (const option of Object.values(command._options)) {
      if (option.name in options) {
        if (option.authority > session.user.authority) {
          return sendHint('internal.low-authority')
        }
      }
    }
  })

  // check argv
  ctx.before('command/execute', (argv: Argv) => {
    const { args, options, command, session } = argv
    function sendHint(message: string, ...param: any[]) {
      return command.config.showWarning ? session.text(message, param) : ''
    }

    // check argument count
    if (command.config.checkArgCount) {
      const nextArg = command._arguments[args.length] || {}
      if (nextArg.required) {
        return sendHint('internal.insufficient-arguments')
      }
      const finalArg = command._arguments[command._arguments.length - 1] || {}
      if (args.length > command._arguments.length && finalArg.type !== 'text' && !finalArg.variadic) {
        return sendHint('internal.redunant-arguments')
      }
    }

    // check unknown options
    if (command.config.checkUnknown) {
      const unknown = Object.keys(options).filter(key => !command._options[key])
      if (unknown.length) {
        return sendHint('internal.unknown-option', unknown.join(', '))
      }
    }
  })

  ctx.i18n.define('internal', {
    zh: {
      'low-authority': '权限不足。',
      'insufficient-arguments': '缺少参数，输入帮助以查看用法。',
      'redunant-arguments': '存在多余参数，输入帮助以查看用法。',
      'invalid-argument': '参数 {0} 输入无效，{1}',
      'unknown-option': '存在未知选项 {0}，输入帮助以查看用法。',
      'invalid-option': '选项 {0} 输入无效，{1}',
      'check-syntax': '输入帮助以查看用法。',
      'invalid-number': '请提供一个数字。',
      'invalid-integer': '请提供一个整数。',
      'invalid-posint': '请提供一个正整数。',
      'invalid-natural': '请提供一个非负整数。',
      'invalid-date': '请输入合法的时间。',
      'invalid-user': '请指定正确的用户。',
      'invalid-channel': '请指定正确的频道。',
    },
    en: {
      'low-authority': 'Low authority.',
      'insufficient-arguments': 'Insufficient arguments, type help to see usage.',
      'redunant-arguments': 'Redunant arguments, type help to see usage.',
      'invalid-argument': 'Invalid argument {0}, {1}',
      'unknown-option': 'Unknown option {0}, type help to see usage.',
      'invalid-option': 'Invalid option {0}, {1}',
      'check-syntax': 'Type help to see usage.',
      'invalid-number': 'Expect a number.',
      'invalid-integer': 'Expect an integer.',
      'invalid-posint': 'Expect a positive integer.',
      'invalid-natural': 'Expect a non-negative integer.',
      'invalid-date': 'Expect a valid date.',
      'invalid-user': 'Expect a valid user.',
      'invalid-channel': 'Expect a valid channel.',
    },
  })
}
