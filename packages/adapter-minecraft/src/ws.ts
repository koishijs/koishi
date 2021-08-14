import { App, Adapter, Session } from 'koishi-core'
import { createBot } from 'mineflayer'
import { MinecraftBot } from './bot'

export default class WsClient extends Adapter.WsClient<'minecraft'> {
  constructor(app: App) {
    super(app, MinecraftBot)
  }

  async prepare(bot: MinecraftBot) {
    const config = {
      skipValidation: true,
      host: '1.1.1.1', // minecraft server ip
      username: 'bot', // minecraft username
      password: '12345678', // minecraft password, comment out if you want to log into online-mode=false servers
      port: 25565, // only set if you need a port that isn't 25565
    }
    bot.client = createBot(config)
    return {
      url: 'minecraft://' + config.host + ':' + config.port + '/' + config.username,
      on(name, event) {
        if (name === 'open') bot.client.on('login', () => event())
        if (name === 'error') bot.client.on('error', (err) => event(err))
        if (name === 'close') bot.client.on('kicked', (reason) => event(reason))
      },
    } as any
  }

  async connect(bot: MinecraftBot) {
    const common: Partial<Session> = {
      platform: 'minecraft',
      type: 'message',
      selfId: bot.client.username,
    }

    bot.client.on('chat', (author, content, translate, jsonMsg, matches) => {
      if (author === bot.client.username) return
      this.dispatch(new Session(this.app, {
        ...common,
        content,
        author: { userId: author },
        channelId: '_public',
      }))
    })
    bot.client.on('whisper', (author, content, translate, jsonMsg, matches) => {
      this.dispatch(new Session(this.app, {
        ...common,
        content,
        author: { userId: author },
        channelId: author,
      }))
    })
    setInterval(() => {
      // Keep alive
      bot.client.setControlState('jump', true)
      bot.client.setControlState('jump', false)
    }, 3000)
  }
}
