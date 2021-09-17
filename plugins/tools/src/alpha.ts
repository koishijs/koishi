import { Context, Session, segment } from 'koishi'
import { xml2js } from 'xml-js'

function extractData(subpod: any, inline = false) {
  const text = subpod.plaintext?._text
  if (text?.match(/^[a-zA-Z0-9 "',?!;:()-]+$/)) {
    return text
  } else if (subpod.img) {
    const { src, height } = subpod.img._attributes
    return (height >= 30 && inline ? '\n' : '') + segment('image', { file: src })
  }
}

export interface AlphaOptions {
  wolframAlphaAppId?: string
}

async function showFull(session: Session, input: string, appid: string) {
  const data = await session.app.http.get('http://api.wolframalpha.com/v2/query', { input, appid })
  const { queryresult } = xml2js(data, { compact: true }) as any
  if (queryresult._attributes.success !== 'true') {
    return 'failed'
  }
  const output = [`Question from ${session.username}: ${input}`]
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
}

async function showShort(session: Session, input: string, appid: string) {
  return session.app.http.get<string>('http://api.wolframalpha.com/v1/result', { input, appid })
}

export const name = 'alpha'

export function apply(ctx: Context, config: AlphaOptions) {
  const { wolframAlphaAppId: appid } = config
  ctx.command('tools/alpha <expr:text>', '调用 WolframAlpha 查询', { maxUsage: 10 })
    .option('full', '-f 显示完整内容')
    .example('alpha How big is the universe?')
    .example('alpha -f int(sinx)')
    .action(async ({ session, options }, input) => {
      if (!input) return '请输入问题。'
      try {
        return (options.full ? showFull : showShort)(session, input, appid)
      } catch (error) {
        console.log(error.toJSON())
      }
    })
}
