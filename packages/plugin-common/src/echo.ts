import { MetaTypeMap, Context, CommandConfig } from 'koishi-core'

export default function (ctx: Context, options: CommandConfig) {
  ctx.command('echo <message...>', '向多个上下文发送广播', { authority: 2, ...options })
    .option('-u, --user <id>', '指定信息发送的目标 QQ 号', { isString: true, authority: 4 })
    .option('-g, --group <id>', '指定信息发送的目标群号', { isString: true, authority: 4 })
    .option('-d, --discuss <id>', '指定信息发送的目标讨论组号', { isString: true, authority: 4 })
    .usage('各 id 之间请使用逗号分隔。')
    .action(({ options, meta }, message) => {
      const channels = {
        private: options.user ? options.user.split(',') : [],
        group: options.group ? options.group.split(',') : [],
        discuss: options.discuss ? options.discuss.split(',') : [],
      } as Record<MetaTypeMap['message'], number[]>
      if (!channels.private.length && !channels.group.length && !channels.discuss.length) {
        channels[meta.messageType].push(meta.messageType === 'private' ? meta.userId : meta[meta.messageType + 'Id'])
      }
      for (const id of channels.private) {
        ctx.sender.sendPrivateMsg(Number(id), message)
      }
      for (const id of channels.group) {
        ctx.sender.sendGroupMsg(Number(id), message)
      }
      for (const id of channels.discuss) {
        ctx.sender.sendDiscussMsg(Number(id), message)
      }
    })
}
