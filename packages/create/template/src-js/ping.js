module.exports.apply = (ctx) => {
  ctx.middleware(async (session, next) => {
    if (session.content === 'ping') {
      session.send('pong')
    } else {
      return next()
    }
  })
}
