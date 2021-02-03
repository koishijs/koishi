export type Template = string | Template.Store

export function Template(path: string, ...params: any[]) {
  return Template.format(Template.get(path), ...params)
}

export namespace Template {
  export interface Store {
    [K: string]: Template
  }

  const root: Store = {}

  export function set(path: string, value: Template) {
    const seg = path.split('.')
    let node: Template = root
    while (seg.length > 1) {
      node = node[seg.shift()] ||= {}
    }
    node[seg[0]] = value
  }

  export function get(path: string) {
    const seg = path.split('.')
    let node: Template = root
    do {
      node = node[seg.shift()]
    } while (seg.length && node)
    return typeof node === 'string' ? node : path
  }

  export function format(source: string, ...params: any[]) {
    let result = ''
    let cap: RegExpExecArray
    // eslint-disable-next-line no-cond-assign
    while (cap = /\{([\w-]+)\}/.exec(source)) {
      result += source.slice(0, cap.index) + (cap[1] in params ? params[cap[1]] : '')
      source = source.slice(cap.index + cap[0].length)
    }
    return result + source
  }

  export function quote(content: any) {
    return get('basic.left-quote') + content + get('basic.right-quote')
  }

  export function brace(items: any[]) {
    if (!items.length) return ''
    return get('basic.left-brace') + items.join(get('basic.comma')) + get('basic.right-brace')
  }
}

/* eslint-disable quote-props */
Template.set('basic', {
  'left-brace': '（',
  'right-brace': '）',
  'left-quote': '“',
  'right-quote': '”',
  'comma': '，',
  'and': '和',
  'or': '或',
})

Template.set('internal', {
  // command
  'low-authority': '权限不足。',
  'usage-exhausted': '调用次数已达上限。',
  'too-frequent': '调用过于频繁，请稍后再试。',
  'insufficient-arguments': '缺少参数，请检查指令语法。',
  'redunant-arguments': '存在多余参数，请检查指令语法。',
  'invalid-argument': '参数 {0} 输入无效，{1}',
  'unknown-option': '存在未知选项 %s，请检查指令语法。',
  'invalid-option': '选项 {0} 输入无效，{1}',
  'check-syntax': '请检查语法。',

  // suggest
  'suggestion': '你要找的是不是{0}？',
  'command-suggestion-prefix': '',
  'command-suggestion-suffix': '发送空行或句号以使用推测的指令。',

  // help
  'help-suggestion-prefix': '指令未找到。',
  'help-suggestion-suffix': '发送空行或句号以使用推测的指令。',
  'subcommand-prolog': '可用的子指令有{0}：',
  'global-help-prolog': '当前可用的指令有{0}：',
  'global-help-epilog': '输入“帮助+指令名”查看特定指令的语法和使用示例。',
  'available-options': '可用的选项有：',
  'available-options-with-authority': '可用的选项有（括号内为额外要求的权限等级）：',
  'option-not-usage': '（不计入总次数）',
  'hint-authority': '括号内为对应的最低权限等级',
  'hint-subcommand': '标有星号的表示含有子指令',
  'command-aliases': '别名：{0}。',
  'command-examples': '使用示例：',
  'command-authority': '最低权限：{0} 级。',
  'command-max-usage': '已调用次数：{0}/{1}。',
  'command-min-interval': '距离下次调用还需：{0}/{1} 秒。',
})
