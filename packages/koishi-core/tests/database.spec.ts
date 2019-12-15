import { App, registerDatabase, injectMethods, AbstractDatabase, createUser, extendUser, createGroup, extendGroup } from '../src'

declare module '../src/database' {
  interface Subdatabases {
    foo?: FooDatabase
    bar?: BarDatabase
  }

  interface DatabaseConfig {
    foo?: FooOptions
    bar?: BarOptions
  }

  interface UserData {
    foo: string
    bar: number[]
  }

  interface GroupData {
    bar: string
    foo: number[]
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
  public identifier = 'foo'
  constructor (public options: FooOptions) {}

  myFunc (value: number) {
    return this.options.value + value
  }
}

interface BarOptions {}

class BarDatabase implements AbstractDatabase {
  public identifier = 'bar'
  constructor (public options: BarOptions) {}
}

registerDatabase('foo', FooDatabase)
registerDatabase('bar', BarDatabase)

injectMethods('foo', 'user', {
  myUserFunc1 () {
    return 'my-foo-user-func'
  },
})

injectMethods('foo', 'user', {
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
    expect(() => injectMethods('temp' as any, 'user', {})).not.toThrow()
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

describe('extend fields', () => {
  test('extend user fields', () => {
    const id = 123
    const authority = 4
    const user = createUser(id, authority)

    const extension = { foo: 'foo', bar: [0] }
    extendUser(() => ({ ...extension }))

    expect(createUser(id, authority)).toMatchObject({
      ...user,
      ...extension,
    })
  })

  test('extend group fields', () => {
    const id = 12345
    const assignee = 54321
    const user = createGroup(id, assignee)

    const extension = { bar: 'bar', foo: [0] }
    extendGroup(() => ({ ...extension }))

    expect(createGroup(id, assignee)).toMatchObject({
      ...user,
      ...extension,
    })
  })
})
