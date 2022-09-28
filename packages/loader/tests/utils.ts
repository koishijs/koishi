import { Dict, Logger, Plugin } from 'koishi'
import { Loader } from '../src'

const logger = new Logger('app')

export default class TestLoader extends Loader {
  data: Dict<Plugin.Object> = Object.create(null)

  async resolvePlugin(name: string) {
    return this.data[name] ||= {
      name,
      apply: (ctx) => {
        ctx.accept()
      },
    }
  }

  readConfig() {
    return null as any
  }

  writeConfig() {
    logger.info('write config')
  }

  fullReload() {
    console.info('trigger full reload')
  }
}
