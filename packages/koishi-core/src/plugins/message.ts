/* eslint-disable prefer-const */

export namespace Message {
  // validate.ts
  export let LOW_AUTHORITY = '权限不足。'
  export let TOO_FREQUENT = '调用过于频繁，请稍后再试。'
  export let INSUFFICIENT_ARGUMENTS = '缺少参数，请检查指令语法。'
  export let REDUNANT_ARGUMENTS = '存在多余参数，请检查指令语法。'
  export let INVALID_OPTION = '选项 %s 输入无效，%s'
  export let INVALID_ARGUMENT = '参数 %s 输入无效，%s'
  export let UNKNOWN_OPTIONS = '存在未知选项 %s，请检查指令语法。'
  export let CHECK_SYNTAX = '请检查指令语法。'
  export let SHOW_THIS_MESSAGE = '显示本信息'
  export let USAGE_EXHAUSTED = '调用次数已达上限。'

  // suggest.ts
  export let SUGGESTION = '你要找的是不是%s？'
  export let COMMAND_SUGGEST_PREFIX = ''
  export let COMMAND_SUGGEST_SUFFIX = '发送空行或句号以调用推测的指令。'

  // help.ts
  export let HELP_SUGGEST_PREFIX = '指令未找到。'
  export let HELP_SUGGEST_SUFFIX = '发送空行或句号以调用推测的指令。'
  export let GLOBAL_HELP_EPILOG = [
    '群聊普通指令可以通过“@我+指令名”的方式进行触发。',
    '私聊或全局指令则不需要添加上述前缀，直接输入指令名即可触发。',
    '输入“帮助+指令名”查看特定指令的语法和使用示例。',
  ].join('\n')
}
