import { testDatabase } from 'koishi-test-utils'
import { resolve } from 'path'
import { App, injectMethods } from 'koishi-core'
import del from 'del'
import '../src'

// workaround levelup poor typings
declare module 'levelup' {
  interface LevelUp {
    clear (): Promise<void>
  }
}

declare module 'koishi-core/dist/database' {
  interface TableMethods {
    myTable: {}
  }

  interface TableData {
    myTable: MyTable
  }
}

interface MyTable {
  id: number
  foo: string
}

const path = resolve(__dirname, '../temp')

afterAll(() => del(path))

injectMethods('level', 'myTable', {})

// testDatabase({
//   level: { path },
// }, {
//   beforeEachUser: app => app.database.level.tables.user.clear(),
//   beforeEachGroup: app => app.database.level.tables.group.clear(),
// })

describe('incremental index', () => {
  const app = new App({ database: { level: { path: resolve(__dirname, '../temp') }, } })
  test('foo', async () => {
    expect(1).toBe(1)
    await app.database.level.create('myTable', { foo: 'bar' })
    await expect(app.database.level.tables.myTable.get(1)).resolves.toMatchObject({ id: 1, foo: 'bar' })
    await app.database.level.create('myTable', { foo: 'baz' })
    await expect(app.database.level.tables.myTable.get(2)).resolves.toMatchObject({ id: 2, foo: 'baz' })
  })
})
