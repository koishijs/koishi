import { createHash } from 'crypto'
import { Context } from 'koishi-core'
import axios from 'axios'

const languages = {
  'zh-CHS': '中文',
  'en': '英文',
  'ja': '日文',
  'ko': '韩文',
  'fr': '法文',
  'es': '西班牙文',
  'pt': '葡萄牙文',
  'it': '意大利文',
  'ru': '俄文',
  'vi': '越南文',
  'de': '德文',
  'ar': '阿拉伯文',
  'id': '印尼文',
}

export interface TranslateOptions {
  youdaoAppKey?: string
  youdaoSecret?: string
}

export function apply (ctx: Context, config: TranslateOptions) {
  const { youdaoAppKey: appKey, youdaoSecret: secret } = config
  if (!secret) throw new Error('missing configuration "youdaoSecret"')

  ctx.command('tools/translate <text>', '翻译工具')
    .alias('翻译')
    .option('-f, --from <lang>', '指定源语言，默认为自动匹配', { default: '' })
    .option('-t, --to <lang>', '指定目标语言，默认为中文（zh-CHS）', { default: 'zh-CHS' })
    .usage('支持的语言名包括 zh-CHS, en, ja, ko, fr, es, pt, it, ru, vi, de, ar, id, it。')
    .action(async ({ session, options }, text) => {
      if (!text) return
      const salt = new Date().getTime()
      const q = String(text)
      const qShort = q.length > 20 ? q.slice(0, 10) + q.length + q.slice(-10) : q
      const from = options.from
      const to = options.to
      const sign = createHash('md5').update(appKey + qShort + salt + secret).digest('hex')
      const { data } = await axios.get('http://openapi.youdao.com/api', {
        params: { q, appKey, salt, from, to, sign },
      })

      if (Number(data.errorCode)) return `翻译失败，错误码：${data.errorCode}`

      const [source, target] = data.l.split('2')
      const output = [
        `原文本：${data.query}`,
        `语言：${languages[source]} -> ${languages[target]}`,
        `翻译结果：${data.translation.join('\n')}`,
      ]
      if (data.basic) {
        if (data.basic.phonetic) {
          output.push(data.basic.phonetic)
        }
        output.push(...data.basic.explains)
      }
      return output.join('\n')
    })
}
