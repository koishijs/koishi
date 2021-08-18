import { ORMTests } from './orm'
import { App } from 'koishi-core'

export namespace Tests {
  type UnitOptions<T> = (T extends (app: App, options?: infer R) => any ? R : {}) & {
    [K in keyof T]?: false | UnitOptions<T[K]>
  }

  type Unit<T> = ((app: App, options?: UnitOptions<T>) => void) & {
    [K in keyof T]: Unit<T[K]>
  }

  function createUnit<T>(target: T, title?: string): Unit<T> {
    const test: any = (app: App, options: any = {}) => {
      function callback() {
        if (typeof target === 'function') {
          target(app, options)
        }

        for (const key in target) {
          if (options[key] === false) continue
          test[key](app, options[key])
        }
      }

      if (title) {
        describe(title, callback)
      } else {
        callback()
      }
    }

    for (const key in target) {
      test[key] = createUnit(target[key], key.replace(/(?=[A-Z])/g, ' ').trimStart())
    }

    return test
  }

  export const orm = createUnit(ORMTests)
}
