import { Bot, Session } from 'koishi-core'

Bot.prototype.sendGroupMsg = Bot.prototype.sendPrivateMsg = async function (this: Bot, channelId, content) {
  if (!content) return
  const data = await this.tomon.api.route(`/channels/${channelId}/messages`).post({ data: { content } })
  console.log(data)
  return 0
}

Session.prototype.$send = async function $send(this: Session, message: string) {
  if (!message) return
  await this.$bot.sendPrivateMsg(this.channelId, message)
}
