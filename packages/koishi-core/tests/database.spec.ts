import { App, registerDatabase, injectMethods, createUser, extendUser, createGroup, extendGroup } from 'koishi-core'

declare module 'koishi-core/dist/database' {
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

  interface UserMethods {
    myUserFunc1?: () => string
    myUserFunc2?: () => string
  }

  interface TableMethods {
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
  constructor(public options: FooOptions) {}

  myFunc(value: number) {
    return this.options.value + value
  }
}

interface BarOptions {}

class BarDatabase {
  constructor(public options: BarOptions) {}
}

injectMethods('foo', 'user', {
  myUserFunc1() {
    return 'my-foo-user-func'
  },
})

injectMethods('foo', 'user', {
  myUserFunc2() {
    return this.myUserFunc1() + '-' + this.myFunc(1)
  },
})

registerDatabase('foo', FooDatabase)
registerDatabase('bar', BarDatabase)

injectMethods('bar', 'user', {
  myUserFunc1() {
    return 'my-bar-user-func'
  },
})

injectMethods('bar', 'baz', {
  myBazFunc() {
    return 'my-bar-baz-func'
  },
})

let app: App

describe('inject methods', () => {
  test('inject methods for unknown database', () => {
    expect(() => injectMethods('temp' as any, 'user', {})).not.to.throw()
  })

  test('inject methods for unknown table', () => {
    expect(() => injectMethods('foo', 'temp' as any, {})).not.to.throw()
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
    expect(app.database.foo.myFunc(10)).to.equal(11)
    expect(app.database.myUserFunc1()).to.equal('my-foo-user-func')
    expect(app.database.myUserFunc2()).to.equal('my-foo-user-func-2')
  })
})

describe('multiple databases', () => {
  test('table conflict', () => {
    expect(() => new App({
      database: {
        foo: { value: 1 },
        // make coverage happy
        bar: { identifier: 'id' },
      },
    })).to.throw()
  })

  test('database not found', () => {
    expect(() => new App({
      database: {
        $tables: { user: 'baz' as any },
      },
    })).to.throw()
  })

  test('explicit bound tables', () => {
    expect(() => app = new App({
      database: {
        $tables: { user: 'foo' },
        foo: { value: 1 },
        bar: {},
      },
    })).not.to.throw()

    expect(app.database.foo).toBeInstanceOf(FooDatabase)
    expect(app.database.bar).toBeInstanceOf(BarDatabase)
    expect(app.database.foo.myFunc(10)).to.equal(11)
    expect(app.database.myUserFunc1()).to.equal('my-foo-user-func')
    expect(app.database.myUserFunc2()).to.equal('my-foo-user-func-2')
    expect(app.database.myBazFunc()).to.equal('my-bar-baz-func')
  })
})

describe('extend fields', () => {
  test('extend user fields', () => {
    const id = 123
    const authority = 4
    const user = createUser(id, authority)

    const extension = { foo: 'foo', bar: [0] }
    extendUser(() => ({ ...extension }))

    expect(createUser(id, authority)).to.have.shape({
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

    expect(createGroup(id, assignee)).to.have.shape({
      ...user,
      ...extension,
    })
  })
})

test('Open & Close', async () => {
  const app = new App({
    database: { $tables: {} },
  })
  await expect(app.start()).resolves.toBeUndefined()
  await expect(app.stop()).resolves.toBeUndefined()
})
