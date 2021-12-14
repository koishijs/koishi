import { App } from 'koishi'
import { expect } from 'chai'

interface Foo {
  id?: number
  text?: string
  value?: number
  list?: number[]
  date?: Date
}

declare module 'koishi' {
  interface Tables {
    temp1: Foo
  }
}

function QueryOperators(app: App) {
  app.model.extend('temp1', {
    id: 'unsigned',
    text: 'string',
    value: 'integer',
    list: 'list',
    date: 'timestamp',
  }, {
    autoInc: true,
  })
}

namespace QueryOperators {
  export const comparison = function Comparison(app: App) {
    before(async () => {
      await app.database.remove('temp1', {})
      await app.database.create('temp1', { text: 'awesome foo', date: new Date('2000-01-01') })
      await app.database.create('temp1', { text: 'awesome bar' })
      await app.database.create('temp1', { text: 'awesome baz' })
    })

    it('basic support', async () => {
      await expect(app.database.get('temp1', {
        id: { $eq: 2 },
      })).eventually.to.have.length(1).with.nested.property('0.text').equal('awesome bar')

      await expect(app.database.get('temp1', {
        id: { $ne: 3 },
      })).eventually.to.have.length(2).with.nested.property('0.text').equal('awesome foo')

      await expect(app.database.get('temp1', {
        id: { $gt: 1 },
      })).eventually.to.have.length(2).with.nested.property('1.text').equal('awesome baz')

      await expect(app.database.get('temp1', {
        id: { $gte: 3 },
      })).eventually.to.have.length(1).with.nested.property('0.text').equal('awesome baz')

      await expect(app.database.get('temp1', {
        id: { $lt: 1 },
      })).eventually.to.have.length(0)

      await expect(app.database.get('temp1', {
        id: { $lte: 2 },
      })).eventually.to.have.length(2).with.nested.property('0.text').equal('awesome foo')
    })

    it('date comparisons', async () => {
      await expect(app.database.get('temp1', {
        date: { $gt: new Date('1999-01-01') },
      })).eventually.to.have.length(1).with.nested.property('0.text').equal('awesome foo')

      await expect(app.database.get('temp1', {
        date: { $lte: new Date('1999-01-01') },
      })).eventually.to.have.length(0)
    })

    it('shorthand syntax', async () => {
      await expect(app.database.get('temp1', {
        id: 2,
      })).eventually.to.have.length(1).with.nested.property('0.text').equal('awesome bar')

      await expect(app.database.get('temp1', {
        date: new Date('2000-01-01'),
      })).eventually.to.have.length(1).with.nested.property('0.text').equal('awesome foo')
    })
  }

  export const membership = function Membership(app: App) {
    before(async () => {
      await app.database.remove('temp1', {})
      await app.database.create('temp1', { value: 3 })
      await app.database.create('temp1', { value: 4 })
      await app.database.create('temp1', { value: 7 })
    })

    it('edge cases', async () => {
      await expect(app.database.get('temp1', {
        value: { $in: [] },
      })).eventually.to.have.length(0)

      await expect(app.database.get('temp1', {
        value: { $nin: [] },
      })).eventually.to.have.length(3)
    })

    it('basic support', async () => {
      await expect(app.database.get('temp1', {
        value: { $in: [3, 4, 5] },
      })).eventually.to.have.length(2)

      await expect(app.database.get('temp1', {
        value: { $nin: [4, 5, 6] },
      })).eventually.to.have.length(2)
    })

    it('shorthand syntax', async () => {
      await expect(app.database.get('temp1', {
        value: [],
      })).eventually.to.have.length(0)

      await expect(app.database.get('temp1', {
        value: [3, 4, 5],
      })).eventually.to.have.length(2)
    })
  }

  interface RegExpOptions {
    regexBy?: boolean
    regexFor?: boolean
  }

  export const regexp = function RegularExpression(app: App, options: RegExpOptions = {}) {
    const { regexBy = true } = options

    before(async () => {
      await app.database.remove('temp1', {})
      await app.database.create('temp1', { text: 'awesome foo' })
      await app.database.create('temp1', { text: 'awesome bar' })
      await app.database.create('temp1', { text: 'awesome foo bar' })
    })

    regexBy && it('$regexBy', async () => {
      await expect(app.database.get('temp1', {
        text: { $regex: /^.*foo.*$/ },
      })).eventually.to.have.length(2)

      await expect(app.database.get('temp1', {
        text: { $regex: /^.*bar$/ },
      })).eventually.to.have.length(2)
    })

    regexBy && it('shorthand syntax', async () => {
      await expect(app.database.get('temp1', {
        text: /^.*foo$/,
      })).eventually.to.have.length(1).with.nested.property('[0].text').equal('awesome foo')
    })
  }

  export const bitwise = function Bitwise(app: App) {
    before(async () => {
      await app.database.remove('temp1', {})
      await app.database.create('temp1', { value: 3 })
      await app.database.create('temp1', { value: 4 })
      await app.database.create('temp1', { value: 7 })
    })

    it('basic support', async () => {
      await expect(app.database.get('temp1', {
        value: { $bitsAllSet: 3 },
      })).eventually.to.have.shape([{ value: 3 }, { value: 7 }])

      await expect(app.database.get('temp1', {
        value: { $bitsAllClear: 9 },
      })).eventually.to.have.shape([{ value: 4 }])

      await expect(app.database.get('temp1', {
        value: { $bitsAnySet: 4 },
      })).eventually.to.have.shape([{ value: 4 }, { value: 7 }])

      await expect(app.database.get('temp1', {
        value: { $bitsAnyClear: 6 },
      })).eventually.to.have.shape([{ value: 3 }, { value: 4 }])
    })
  }

  interface ListOptions {
    size?: boolean
    element?: boolean
    elementQuery?: boolean
  }

  export const list = function List(app: App, options: ListOptions = {}) {
    const { size = true, element = true, elementQuery = element } = options

    before(async () => {
      await app.database.remove('temp1', {})
      await app.database.create('temp1', { id: 1, list: [] })
      await app.database.create('temp1', { id: 2, list: [23] })
      await app.database.create('temp1', { id: 3, list: [233] })
      await app.database.create('temp1', { id: 4, list: [233, 332] })
    })

    size && it('$size', async () => {
      await expect(app.database.get('temp1', {
        list: { $size: 1 },
      })).eventually.to.have.length(2).with.shape([{ id: 2 }, { id: 3 }])
    })

    element && it('$el shorthand', async () => {
      await expect(app.database.get('temp1', {
        list: { $el: 233 },
      })).eventually.to.have.length(2).with.shape([{ id: 3 }, { id: 4 }])
    })

    elementQuery && it('$el with field temp1', async () => {
      await expect(app.database.get('temp1', {
        list: { $el: { $lt: 50 } },
      })).eventually.to.have.shape([{ id: 2 }])
    })
  }

  export const evaluation = function Evaluation(app: App) {
    before(async () => {
      await app.database.remove('temp1', {})
      await app.database.create('temp1', { id: 1, value: 8 })
      await app.database.create('temp1', { id: 2, value: 7 })
      await app.database.create('temp1', { id: 3, value: 9 })
    })

    it('arithmetic operators', async () => {
      await expect(app.database.get('temp1', {
        $expr: {
          $eq: [9, {
            $add: [
              { $: 'id' },
              { $: 'value' },
            ],
          }],
        },
      })).eventually.to.have.length(2).with.shape([{ id: 1 }, { id: 2 }])
    })
  }

  namespace Logical {
    export const queryLevel = function LogicalQueryLevel(app: App) {
      before(async () => {
        await app.database.remove('temp1', {})
        await app.database.create('temp1', { id: 1 })
        await app.database.create('temp1', { id: 2 })
        await app.database.create('temp1', { id: 3 })
      })

      it('edge cases', async () => {
        await expect(app.database.get('temp1', {})).eventually.to.have.length(3)
        await expect(app.database.get('temp1', { $and: [] })).eventually.to.have.length(3)
        await expect(app.database.get('temp1', { $or: [] })).eventually.to.have.length(0)
        await expect(app.database.get('temp1', { $not: {} })).eventually.to.have.length(0)
        await expect(app.database.get('temp1', { $not: { $and: [] } })).eventually.to.have.length(0)
        await expect(app.database.get('temp1', { $not: { $or: [] } })).eventually.to.have.length(3)
      })

      it('$or', async () => {
        await expect(app.database.get('temp1', {
          $or: [{ id: 1 }, { id: { $ne: 2 } }],
        })).eventually.to.have.length(2).with.shape([{ id: 1 }, { id: 3 }])

        await expect(app.database.get('temp1', {
          $or: [{ id: 1 }, { id: { $eq: 2 } }],
        })).eventually.to.have.length(2).with.shape([{ id: 1 }, { id: 2 }])

        await expect(app.database.get('temp1', {
          $or: [{ id: { $ne: 1 } }, { id: { $ne: 2 } }],
        })).eventually.to.have.length(3).with.shape([{ id: 1 }, { id: 2 }, { id: 3 }])
      })

      it('$and', async () => {
        await expect(app.database.get('temp1', {
          $and: [{ id: 1 }, { id: { $ne: 2 } }],
        })).eventually.to.have.length(1).with.shape([{ id: 1 }])

        await expect(app.database.get('temp1', {
          $and: [{ id: 1 }, { id: { $eq: 2 } }],
        })).eventually.to.have.length(0)

        await expect(app.database.get('temp1', {
          $and: [{ id: { $ne: 1 } }, { id: { $ne: 2 } }],
        })).eventually.to.have.length(1).with.shape([{ id: 3 }])
      })

      it('$not', async () => {
        await expect(app.database.get('temp1', {
          $not: { id: 1 },
        })).eventually.to.have.length(2).with.shape([{ id: 2 }, { id: 3 }])

        await expect(app.database.get('temp1', {
          $not: { id: { $ne: 1 } },
        })).eventually.to.have.length(1).with.shape([{ id: 1 }])
      })
    }

    export const fieldLevel = function LogicalFieldLevel(app: App) {
      before(async () => {
        await app.database.remove('temp1', {})
        await app.database.create('temp1', { id: 1 })
        await app.database.create('temp1', { id: 2 })
        await app.database.create('temp1', { id: 3 })
      })

      it('edge cases', async () => {
        await expect(app.database.get('temp1', { id: {} })).eventually.to.have.length(3)
        await expect(app.database.get('temp1', { id: { $and: [] } })).eventually.to.have.length(3)
        await expect(app.database.get('temp1', { id: { $or: [] } })).eventually.to.have.length(0)
        await expect(app.database.get('temp1', { id: { $not: {} } })).eventually.to.have.length(0)
        await expect(app.database.get('temp1', { id: { $not: { $and: [] } } })).eventually.to.have.length(0)
        await expect(app.database.get('temp1', { id: { $not: { $or: [] } } })).eventually.to.have.length(3)
      })

      it('$or', async () => {
        await expect(app.database.get('temp1', {
          id: { $or: [1, { $gt: 2 }] },
        })).eventually.to.have.length(2).with.shape([{ id: 1 }, { id: 3 }])

        await expect(app.database.get('temp1', {
          id: { $or: [1, { $gt: 2 }], $ne: 3 },
        })).eventually.to.have.length(1).with.shape([{ id: 1 }])
      })

      it('$and', async () => {
        await expect(app.database.get('temp1', {
          id: { $and: [[1, 2], { $lt: 2 }] },
        })).eventually.to.have.length(1).with.shape([{ id: 1 }])

        await expect(app.database.get('temp1', {
          id: { $and: [[1, 2], { $lt: 2 }], $eq: 2 },
        })).eventually.to.have.length(0)
      })

      it('$not', async () => {
        await expect(app.database.get('temp1', {
          id: { $not: 1 },
        })).eventually.to.have.length(2).with.shape([{ id: 2 }, { id: 3 }])

        await expect(app.database.get('temp1', {
          id: { $not: 1, $lt: 3 },
        })).eventually.to.have.length(1).with.shape([{ id: 2 }])
      })
    }
  }

  export const logical = Logical
}

export default QueryOperators
