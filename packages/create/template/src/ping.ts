import { Context } from 'koishi'

export function apply(ctx: Context) {
  ctx.middleware(async (session, next) => {
    if (session.content === 'ping') {
      session.send('pong')
    } else {
      return next()
    }
  })
}
