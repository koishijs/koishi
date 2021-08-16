import { expect } from 'chai'
import { Database, Tables } from 'koishi-core'
import { App } from 'koishi-test-utils'
import * as mysql from 'koishi-plugin-mysql'
import { createFilter } from 'koishi-plugin-mysql'

declare module 'koishi-core' {
  interface Tables {
    foo: FooData
  }
}

interface FooData {
  id?: number
  bar: string
}

Tables.extend('foo')

const getMysqlPorts = () => {
  const argv = process.argv.splice(3)
  const match = /^--mysql-ports=(.*)/
  const ports = []
  for (let i = 0; i < argv.length; i++) {
    const envMatch = argv[i].match(match)
    envMatch && ports.push(...envMatch[1].split(',').map(port => +port))
  }
  return ports.length === 0 ? undefined : ports
}

describe('Mysql Database', () => {
  it('should support mysql', async () => {
    Database.extend('koishi-plugin-mysql', ({ tables }) => {
      tables.foo = {
        id: 'BIGINT(20)',
        bar: 'VARCHAR(100)',
      }
    })
    const ports = getMysqlPorts() ?? [3306]
    for (const port of ports) {
      const app = new App()
      app.plugin(mysql, {
        host: 'localhost',
        port: port,
        user: 'koishi',
        password: 'koishi@114514',
        database: 'koishi',
      })
      await app.start()
      await app.stop()
    }
  })

  describe('createFilter', () => {
    it('base support', () => {
      expect(createFilter('foo', [1, 2]))
        .to.equal('`id` IN (1, 2)')

      expect(createFilter('foo', { id: [1, 2] }))
        .to.equal('`id` IN (1, 2)')

      expect(createFilter('foo', { id: [1, 2], bar: ['foo'] }))
        .to.equal('`id` IN (1, 2) && `bar` IN (\'foo\')')
    })

    it('compile expr query', () => {
      expect(createFilter('foo', { id: { $gt: 2 } })).to.equal('`id` > 2')

      expect(createFilter('foo', { id: { $eq: 2 } })).to.equal('`id` = 2')

      expect(createFilter('foo', { id: { $ne: 2 } })).to.equal('`id` != 2')

      expect(createFilter('foo', {
        id: { $gt: 2 },
        bar: /^.*foo/,
      })).to.equal('`id` > 2 && `bar` REGEXP \'^.*foo\'')
    })

    it('filter data by include', () => {
      expect(createFilter('foo', {
        id: { $in: [2] },
      })).to.equal('`id` IN (2)')

      expect(createFilter('foo', {
        id: { $nin: [2, 3, 5] },
      })).to.equal('`id` NOT IN (2, 3, 5)')
    })

    it('should verify empty array', () => {
      expect(createFilter('foo', [])).to.equal('0')

      expect(createFilter('foo', { id: [] })).to.equal('0')

      expect(createFilter('foo', { id: { $in: [] } })).to.equal('0')

      expect(createFilter('foo', { id: { $nin: [] } })).to.equal('1')
    })

    it('filter data by regex', () => {
      expect(createFilter('foo', { bar: /^.*foo/ }))
        .to.equal('`bar` REGEXP \'^.*foo\'')

      expect(createFilter('foo', { bar: { $regex: /^.*foo/ } }))
        .to.equal('`bar` REGEXP \'^.*foo\'')
    })

    it('should verify `$or`', () => {
      expect(createFilter('foo', {
        $or: [{ bar: { $regex: /^.*foo/ } }, { bar: { $regex: /^foo.*/ } }],
      })).to.equal('(`bar` REGEXP \'^.*foo\' || `bar` REGEXP \'^foo.*\')')

      expect(createFilter('foo', {
        $or: [{ id: [1, 2] }, { bar: { $regex: /^foo.*/ } }],
      })).to.equal('(`id` IN (1, 2) || `bar` REGEXP \'^foo.*\')')
    })

    it('should verify `$or` and other key`', () => {
      expect(createFilter('foo', {
        id: [1, 2],
        $or: [{ bar: { $regex: /^foo.*/ } }],
      })).to.equal('`id` IN (1, 2) && (`bar` REGEXP \'^foo.*\')')

      expect(createFilter('foo', {
        id: { $lt: 2 },
        $or: [{ bar: { $regex: /^foo.*/ } }, { bar: { $regex: /^.*foo/ } }],
      })).to.equal('`id` < 2 && (`bar` REGEXP \'^foo.*\' || `bar` REGEXP \'^.*foo\')')
    })
  })
})
