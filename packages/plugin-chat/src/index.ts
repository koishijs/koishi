import { Context } from 'koishi-core'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { SocketChannel } from 'koishi-plugin-webui'
import { resolve } from 'path'
import debug, { DebugConfig } from './debug'

export * from './debug'

export interface Config extends DebugConfig {}

export const name = 'chat'

export function apply(ctx: Context, options: Config = {}) {
  ctx.plugin(debug, options)

  ctx.with(['koishi-plugin-webui'] as const, (ctx, { SocketChannel }) => {
    const { devMode } = ctx.webui.config
    const filename = devMode ? '../client/index.ts' : '../dist/index.js'
    ctx.webui.addEntry(resolve(__dirname, filename))

    SocketChannel.prototype['$chat'] = async function (this: SocketChannel, { id, token, content, platform, selfId, channelId }) {
      const user = await this.validate(id, token, ['name'])
      if (!user) return
      content = await this.app.transformAssets(content)
      this.app.bots[`${platform}:${selfId}`]?.sendMessage(channelId, content)
    }
  })
}
