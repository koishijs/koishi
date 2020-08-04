import { Context } from 'koishi-core'
import { CQCode } from 'koishi-utils'
import netease from './netease'
import qq from './qq'

const platforms = {
  netease,
  qq,
}

export interface MusicOptions {
  showWarning?: boolean
  platform?: keyof typeof platforms
}

const defaultOptions: MusicOptions = {
  showWarning: false,
  platform: 'qq',
}

export const name = 'music'

export function apply (ctx: Context, options: MusicOptions = {}) {
  const { showWarning, platform } = { ...defaultOptions, ...options }

  ctx.command('tools/music <name...>', '点歌')
    .option('-p, --platform <platform>', `点歌平台，目前支持 qq, netease，默认为 ${platform}`)
    .alias('点歌')
    .shortcut('来一首', { fuzzy: true, oneArg: true })
    .shortcut('点一首', { fuzzy: true, oneArg: true })
    .shortcut('整一首', { fuzzy: true, oneArg: true })
    .action(async ({ options }, keyword) => {
      if (!options.platform) options.platform = platform
      const search = platforms[options.platform]
      if (!search) {
        return `目前不支持平台 ${options.platform}。`
      }

      try {
        const result = await search.call(ctx, keyword)
        if (typeof result === 'object') {
          return CQCode.stringify('music', result)
        }
      } catch {}

      if (showWarning) {
        return '点歌失败，请尝试更换平台。'
      }
    })
}
