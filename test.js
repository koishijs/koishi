const { App } = require('koishi')

const app = new App({
  port: 7070,
  server: 'http://localhost:5700',
  secret: 'kouchya',
  token: 'shigma',
})

app.middleware((meta, next) => {
meta.$send('工具人')
return next()
})
app.receiver.on('message', (meta) => {
meta.$send('工具人')
})

app.start()

console.log('app start...')
