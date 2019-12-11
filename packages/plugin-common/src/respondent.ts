import { Context } from 'koishi-core'

export interface Respondent {
  match: string | RegExp
  reply: string | ((...capture: string[]) => string)
}

export default function apply (ctx: Context, respondents: Respondent[] = []) {
  if (!Array.isArray(respondents) || !respondents.length) return
  ctx.middleware(({ message, $send }, next) => {
    for (const { match, reply } of respondents) {
      const capture = typeof match === 'string' ? message === match && [message] : message.match(match)
      if (capture) {
        return $send(typeof reply === 'string' ? reply : reply(...capture))
      }
    }
    return next()
  })
}
