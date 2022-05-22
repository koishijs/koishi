import { Adapter, assertProperty, Context, Dict, Logger, sanitize, Schema, Session, trimSlash } from 'koishi'
import { BotConfig, TelegramBot } from './bot'
import * as Telegram from './types'
import { AdapterConfig } from './utils'

const logger = new Logger('telegram')

abstract class TelegramAdapter extends Adapter<BotConfig, AdapterConfig> {
  /** Init telegram updates listening */
  abstract listenUpdates(bot: TelegramBot): Promise<void>

  async connect(bot: TelegramBot): Promise<void> {
    const { username, userId, avatar, nickname } = await bot.getLoginInfo()
    bot.username = username
    bot.avatar = avatar
    bot.selfId = userId
    bot.nickname = nickname

    await this.listenUpdates(bot)
    logger.debug('connected to %c', 'telegram:' + bot.selfId)
    bot.resolve()
  }

  async onUpdate(update: Telegram.Update, bot: TelegramBot) {
    logger.debug('receive %s', JSON.stringify(update))
    const session: Partial<Session> = { selfId: bot.selfId }
    session.telegram = Object.create(bot.internal)
    Object.assign(session.telegram, update)

    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post
    if (message) {
      session.type = update.message || update.channel_post ? 'message' : 'message-updated'
      await bot.adaptMessage(message, session)
    } else if (update.chat_join_request) {
      session.timestamp = update.chat_join_request.date * 1000
      session.type = 'guild-member-request'
      session.messageId = `${update.chat_join_request.chat.id}@${update.chat_join_request.from.id}`
      // Telegram join request does not have text
      session.content = ''
      session.channelId = update.chat_join_request.chat.id.toString()
      session.guildId = session.channelId
    } else if (update.my_chat_member) {
      session.timestamp = update.my_chat_member.date * 1000
      session.messageId = `${update.my_chat_member.chat.id}@${update.my_chat_member.from.id}`
      session.content = ''
      session.channelId = update.my_chat_member.chat.id.toString()
      session.guildId = session.channelId
      if (update.my_chat_member.old_chat_member.user.id.toString() === bot.selfId) {
        if (update.my_chat_member.new_chat_member.status === 'left') {
          session.type = 'group-deleted'
        } else if (update.my_chat_member.old_chat_member.status === 'left') {
          session.type = 'group-added'
        }
      }
    }
    logger.debug('receive %o', session)
    this.dispatch(new Session(bot, session))
  }
}

export class HttpServer extends TelegramAdapter {
  static schema = BotConfig

  constructor(ctx: Context, config: AdapterConfig) {
    super(ctx, config)
    config.path = sanitize(config.path || '/telegram')
    if (config.selfUrl) {
      config.selfUrl = trimSlash(config.selfUrl)
    } else {
      config.selfUrl = assertProperty(ctx.app.options, 'selfUrl')
    }
  }

  async listenUpdates(bot: TelegramBot) {
    const { token } = bot.config
    const { path, selfUrl } = this.config
    const info = await bot.internal.setWebhook({
      url: selfUrl + path + '?token=' + token,
      drop_pending_updates: true,
    })
    if (!info) throw new Error('Set webhook failed')
    logger.debug('listening updates %c', 'telegram: ' + bot.selfId)
  }

  async start() {
    const { path } = this.config
    this.ctx.router.post(path, async (ctx) => {
      const payload: Telegram.Update = ctx.request.body
      const token = ctx.request.query.token as string
      const [selfId] = token.split(':')
      const bot = this.bots.find(bot => bot.selfId === selfId) as TelegramBot
      if (!(bot?.config?.token === token)) return ctx.status = 403
      ctx.body = 'OK'
      await this.onUpdate(payload, bot)
    })
  }

  stop() {
    logger.debug('http server closing')
  }
}

export class HttpPolling extends TelegramAdapter {
  static schema = Schema.intersect([
    BotConfig,
    Schema.object({
      pollingTimeout: Schema.union([
        Schema.natural(),
        Schema.transform(Schema.const(true as const), () => 60),
      ]).default(60).description('通过长轮询获取更新时请求的超时 (单位为秒)。'),
    }),
  ])

  private offset: Dict<number> = {}
  private isStopped: boolean

  start() {
    this.isStopped = false
  }

  stop() {
    this.isStopped = true
  }

  async listenUpdates(bot: TelegramBot): Promise<void> {
    const { selfId } = bot
    this.offset[selfId] = this.offset[selfId] || 0

    const { url } = await bot.internal.getWebhookInfo()
    if (url) {
      logger.warn('Bot currently has a webhook set up, trying to remove it...')
      await bot.internal.setWebhook({ url: '' })
    }

    // Test connection / init offset with 0 timeout polling
    const previousUpdates = await bot.internal.getUpdates({
      allowed_updates: [],
      timeout: 0,
    })
    previousUpdates.forEach(e => this.offset[selfId] = Math.max(this.offset[selfId], e.update_id))

    const polling = async () => {
      const updates = await bot.internal.getUpdates({
        offset: this.offset[selfId] + 1,
        timeout: bot.config.pollingTimeout,
      })
      for (const e of updates) {
        this.offset[selfId] = Math.max(this.offset[selfId], e.update_id)
        this.onUpdate(e, bot)
      }

      if (!this.isStopped) {
        setTimeout(polling, 0)
      }
    }
    polling()
    logger.debug('listening updates %c', 'telegram: ' + bot.selfId)
  }
}
