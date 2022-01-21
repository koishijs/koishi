import { Context } from 'koishi'

export interface Rule {
  match: string | RegExp
  reply: string | ((...capture: string[]) => string)
}

export interface Config {
  rules?: Rule[]
}

export const name = 'respondent'

export function apply(ctx: Context, { rules = [] }: Config) {
  ctx.middleware((session, next) => {
    const message = session.content.trim()
    for (const { match, reply } of rules) {
      const capture = typeof match === 'string' ? message === match && [message] : message.match(match)
      if (capture) return typeof reply === 'string' ? reply : reply(...capture)
    }
    return next()
  })
}
