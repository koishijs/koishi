import { Context, Logger, Schema } from 'koishi'
import { promises as fsp } from 'fs'
import { resolve } from 'path'

export const name = 'locales'

const logger = new Logger('locales')

export interface Config {
  root?: string
}

export const Config: Schema<Config> = Schema.object({
  root: Schema.string().default('locales').description('存放用户语言包的根目录。'),
})

export function apply(ctx: Context, config: Config) {
  ctx.on('ready', async () => {
    const folder = resolve(ctx.baseDir, config.root)
    const created = await fsp.mkdir(folder, { recursive: true })
    if (!created) {
      const files = await fsp.readdir(folder)
      for (const file of files) {
        logger.info('loading locale %s', file)
        ctx.i18n.define('$' + file.split('.')[0], require(folder + '/' + file))
      }
    }
  })
}
