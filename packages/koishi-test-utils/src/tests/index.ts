import { ORMTests } from './orm'
import { App } from 'koishi-core'

export namespace Tests {
  type UnitOptions<T> = T extends Function ? T extends (...args: infer R) => any ? R[1] : never : {
    [K in keyof T]?: false | UnitOptions<T[K]>
  }

  type Unit<T> = T extends Function ? T : ((app: App, options?: UnitOptions<T>) => void) & {
    [K in keyof T]: Unit<T[K]>
  }

  function createUnit<T>(target: T): Unit<T> {
    if (typeof target === 'function') return target as any

    const test: any = (app: App, options: any = {}) => {
      for (const key in target) {
        if (options[key] === false) continue
        test[key](app, options[key])
      }
    }

    for (const key in target) {
      test[key] = createUnit(target[key])
    }
    return test
  }

  export const orm = createUnit(ORMTests)
}
