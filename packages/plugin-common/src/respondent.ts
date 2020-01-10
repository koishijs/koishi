import { Context } from 'koishi-core'
import { simplify } from 'koishi-utils'

export interface Respondent {
  match: string | RegExp
  reply: string | ((...capture: string[]) => string)
}

export default function apply (ctx: Context, respondents: Respondent[] = []) {
  if (!respondents.length) return
  ctx.middleware(({ message, $send }, next) => {
    message = simplify(message)
    for (const { match, reply } of respondents) {
      const capture = typeof match === 'string' ? message === match && [message] : message.match(match)
      if (capture) return $send(typeof reply === 'string' ? reply : reply(...capture))
    }
    return next()
  })
}
