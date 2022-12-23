import { Dict, Logger, Plugin } from 'koishi'
import { Loader } from '../src'
import * as jest from 'jest-mock'

const logger = new Logger('app')

export default class TestLoader extends Loader {
  data: Dict<Plugin.Object> = Object.create(null)

  async resolvePlugin(name: string) {
    return this.data[name] ||= {
      name,
      apply: (ctx) => {
        ctx.on(`test/${name}` as any, jest.fn())
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
