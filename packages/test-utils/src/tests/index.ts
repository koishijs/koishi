import { App } from 'koishi'
import BuiltinMethods from './builtin'
import QueryOperators from './query'
import UpdateOperators from './update'

export namespace Tests {
  const Keywords = ['name']
  type Keywords = 'name'

  type UnitOptions<T> = (T extends (app: App, options?: infer R) => any ? R : {}) & {
    [K in keyof T as Exclude<K, Keywords>]?: false | UnitOptions<T[K]>
  }

  type Unit<T> = ((app: App, options?: UnitOptions<T>) => void) & {
    [K in keyof T as Exclude<K, Keywords>]: Unit<T[K]>
  }

  function createUnit<T>(target: T, root = false): Unit<T> {
    const test: any = (app: App, options: any = {}) => {
      function callback() {
        if (typeof target === 'function') {
          target(app, options)
        }

        for (const key in target) {
          if (options[key] === false || Keywords.includes(key)) continue
          test[key](app, options[key])
        }
      }

      const title = target['name']
      if (!root && title) {
        describe(title.replace(/(?=[A-Z])/g, ' ').trimStart(), callback)
      } else {
        callback()
      }
    }

    for (const key in target) {
      if (Keywords.includes(key)) continue
      test[key] = createUnit(target[key])
    }

    return test
  }

  function DatabaseTests(app: App) {
    before(() => app.start())

    after(async () => {
      await app.database.drop()
      await app.stop()
    })
  }

  namespace DatabaseTests {
    export const builtin = BuiltinMethods
    export const query = QueryOperators
    export const update = UpdateOperators
  }

  export const database = createUnit(DatabaseTests, true)
}
