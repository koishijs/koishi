import { Context, segment } from 'koishi'

type Platform = 'netease' | 'qq'

interface Result {
  type: string
  id: string
}

const platforms: Record<Platform, (this: Context, keyword: string) => Promise<Result>> = {
  async netease(keyword) {
    const data = await this.http.get('http://music.163.com/api/cloudsearch/pc', { s: keyword, type: 1, offset: 0, limit: 5 })
    if (data.code !== 200) return
    return {
      type: '163',
      id: data.result.songs[0].id,
    }
  },
  async qq(keyword) {
    const data = await this.http.get('https://c.y.qq.com/soso/fcgi-bin/client_search_cp', { p: 1, n: 5, w: keyword, format: 'json' })
    if (data.code) return
    return {
      type: 'qq',
      id: data.data.song.list[0].songid,
    }
  },
}

export interface MusicOptions {
  showWarning?: boolean
  platform?: Platform
}

const defaultOptions: MusicOptions = {
  showWarning: false,
  platform: 'qq',
}

export const name = 'music'

export function apply(ctx: Context, options: MusicOptions = {}) {
  const { showWarning, platform } = { ...defaultOptions, ...options }

  ctx.command('tools/music <name:text>', '点歌')
    // typescript cannot infer type from string templates
    .option('platform', `-p <platform>  点歌平台，目前支持 qq, netease，默认为 ${platform}`, { type: Object.keys(platforms) })
    .alias('点歌')
    .shortcut('来一首', { fuzzy: true })
    .shortcut('点一首', { fuzzy: true })
    .shortcut('整一首', { fuzzy: true })
    .action(async ({ options }, keyword) => {
      if (!options.platform) options.platform = platform
      const search = platforms[options.platform]
      if (!search) {
        return `目前不支持平台 ${options.platform}。`
      }

      try {
        const result = await search.call(ctx, keyword)
        if (typeof result === 'object') {
          return segment('music', result)
        }
      } catch {}

      if (showWarning) {
        return '点歌失败，请尝试更换平台。'
      }
    })
}
