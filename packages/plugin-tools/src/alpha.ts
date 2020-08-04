import { Context } from 'koishi-core'
import { CQCode } from 'koishi-utils'
import { xml2js } from 'xml-js'
import axios from 'axios'

function extractData (subpod: any, inline = false) {
  const text = subpod.plaintext && subpod.plaintext._text
  if (text && text.match(/^[a-zA-Z0-9 "',?!;:()-]+$/)) {
    return text
  } else if (subpod.img) {
    const { src, height } = subpod.img._attributes
    return (height >= 30 && inline ? '\n' : '') + CQCode.stringify('image', { file: src })
  }
}

export interface AlphaOptions {
  wolframAlphaAppId?: string
}

export function apply (ctx: Context, config: AlphaOptions) {
  const { wolframAlphaAppId: appid } = config
  ctx.command('tools/alpha <expression...>', '调用 WolframAlpha 查询', { maxUsage: 10 })
    .example('alpha int(sinx)')
    .action(async ({ session }, message) => {
      const input = message.slice(message.indexOf('alpha') + 5).trim()
      if (!input) return '请输入问题。'
      try {
        const { data } = await axios.get('http://api.wolframalpha.com/v2/query', {
          params: { input, appid },
        })
        const { queryresult } = xml2js(data, { compact: true }) as any
        if (queryresult._attributes.success !== 'true') {
          return 'failed'
        }
        const output = [`Question from ${session.sender.card || session.sender.nickname}: ${input}`]
        queryresult.pod.forEach((el) => {
          if (Array.isArray(el.subpod)) {
            output.push(el._attributes.title + ': ', ...el.subpod.map(extractData).filter(t => t))
          } else {
            const text = extractData(el.subpod, true)
            if (!text) return
            output.push(el._attributes.title + ': ' + text)
          }
        })
        return output.join('\n')
      } catch (error) {
        console.log(error.toJSON())
      }
    })
    .subcommand('.short <expression...>', '调用 WolframAlpha 短问答', { maxUsage: 10, usageName: 'alpha' })
    .example('alpha.short How big is the universe?')
    .action(async (_, message) => {
      const input = message.slice(message.indexOf('alpha.short') + 11).trim()
      if (!input) return '请输入问题。'
      try {
        const { data } = await axios.get('http://api.wolframalpha.com/v1/result', {
          params: { input, appid },
        })
        return data
      } catch (error) {
        console.log(error.toJSON())
      }
    })
}
