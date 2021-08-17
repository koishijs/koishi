import { MemoryDatabase } from './memory'
import { ORMTests } from './orm'
import { App } from 'koishi-core'

export default MemoryDatabase

export function createArray<T>(length: number, create: (index: number) => T) {
  return [...new Array(length).keys()].map(create)
}

export namespace Tests {
  type TestsUnitOptions<T> = {
    [K in keyof T]: T[K] extends Function ? boolean : boolean | TestsUnitOptions<T[K]>
  }
  interface TestsUnitCallable<T> {
    (app: App, options?: TestsUnitOptions<T>): void
  }
  type TestUnit<T> = TestsUnitCallable<T> & {
    [K in keyof T]: T[K] extends Function ? T[K] : TestUnit<T[K]>
  }

  const genTestUnit = <T extends Record<string, any>>(target: T) => new Proxy<TestUnit<T>>((() => {}) as any, {
    get(_, p: string) {
      const property = target[p]
      if (typeof property === 'function') {
        return property
      } else {
        return genTestUnit(property)
      }
    },
    apply(_, thisArg, [app, options]: [App, TestsUnitOptions<T>]) {
      for (const key in target) {
        if (!(options?.[key] ?? true)) continue

        const property = target[key]
        if (typeof property === 'function') {
          property.apply(thisArg, [app])
        } else {
          genTestUnit(property)(app, options?.[key])
        }
      }
      return undefined
    },
  })
  export const orm = genTestUnit(ORMTests)
}

export * from './app'
