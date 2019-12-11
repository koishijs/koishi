import { App, registerDatabase, injectMethods } from '../src'

declare module '../src/database' {
  interface Subdatabases {
    foo?: FooDatabase
    bar?: BarDatabase
  }

  interface DatabaseConfig {
    foo?: FooOptions
    bar?: BarOptions
  }

  interface UserTable {
    myUserFunc1?: () => string
    myUserFunc2?: () => string
  }

  interface Tables {
    baz: TableBaz
  }
}

interface TableBaz {
  myBazFunc (): string
}

interface FooOptions {
  value?: number
}

class FooDatabase {
  constructor (public options: FooOptions) {}

  myFunc (value: number) {
    return this.options.value + value
  }
}

interface BarOptions {}

class BarDatabase {
  constructor (public options: BarOptions) {}
}

registerDatabase('foo', FooDatabase)
registerDatabase('bar', BarDatabase)

injectMethods('foo', 'user', {
  myUserFunc1 () {
    return 'my-foo-user-func'
  },

  myUserFunc2 () {
    return this.myUserFunc1() + '-' + this.myFunc(1)
  },
})

injectMethods('bar', 'user', {
  myUserFunc1 () {
    return 'my-bar-user-func'
  },
})

injectMethods('bar', 'baz', {
  myBazFunc () {
    return 'my-bar-baz-func'
  },
})

let app: App

describe('inject methods', () => {
  test('inject methods for unknown database', () => {
    expect(() => injectMethods('temp' as any, 'user', {})).toThrow()
  })

  test('inject methods for unknown table', () => {
    expect(() => injectMethods('foo', 'temp' as any, {})).not.toThrow()
  })
})

describe('create database', () => {
  app = new App({
    database: {
      foo: { value: 1 },
    },
  })

  test('create database', () => {
    expect(app.database.foo).toBeInstanceOf(FooDatabase)
    expect(app.database.bar).toBeUndefined()
    expect(app.database.myBazFunc).toBeUndefined()
  })

  test('this binding', () => {
    expect(app.database.foo.myFunc(10)).toBe(11)
    expect(app.database.myUserFunc1()).toBe('my-foo-user-func')
    expect(app.database.myUserFunc2()).toBe('my-foo-user-func-2')
  })
})

describe('multiple databases', () => {
  test('table conflict', () => {
    expect(() => new App({
      database: {
        foo: { value: 1 },
        bar: {},
      },
    })).toThrow()
  })

  test('database not found', () => {
    expect(() => new App({
      database: {
        $tables: { user: 'baz' as any },
      },
    })).toThrow()
  })

  test('explicit bound tables', () => {
    expect(() => app = new App({
      database: {
        $tables: { user: 'foo' },
        foo: { value: 1 },
        bar: {},
      },
    })).not.toThrow()

    expect(app.database.foo).toBeInstanceOf(FooDatabase)
    expect(app.database.bar).toBeInstanceOf(BarDatabase)
    expect(app.database.foo.myFunc(10)).toBe(11)
    expect(app.database.myUserFunc1()).toBe('my-foo-user-func')
    expect(app.database.myUserFunc2()).toBe('my-foo-user-func-2')
    expect(app.database.myBazFunc()).toBe('my-bar-baz-func')
  })
})
