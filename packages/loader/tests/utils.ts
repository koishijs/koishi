import { Dict, Plugin } from 'koishi'
import { Loader } from '../src'
import * as jest from 'jest-mock'

export default class TestLoader extends Loader {
  data: Dict<Plugin.Object> = Object.create(null)

  async import(name: string) {
    return this.data[name] ||= {
      name,
      apply: (ctx) => {
        if (name === 'foo') throw new Error('error from plugin')
        ctx.on(`test/${name}` as any, jest.fn())
        ctx.accept()
      },
    }
  }

  async resolve(name: string) {
    return name
  }

  fullReload() {
    console.info('trigger full reload')
  }
}
