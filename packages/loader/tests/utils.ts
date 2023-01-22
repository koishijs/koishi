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
        if (name === 'foo') throw new Error()
        ctx.on(`test/${name}` as any, jest.fn())
        ctx.accept()
      },
    }
  }

  async resolve(name: string) {
    return name
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
