import { use } from 'chai'
import { inspect } from 'util'

use(({ Assertion }) => {
  function checkShape(expect, actual, path) {
    if (actual === expect || Number.isNaN(expect) && Number.isNaN(actual)) return

    function formatError(expect, actual) {
      return `expected to have ${expect} but got ${actual} at path ${path}`
    }

    if (!expect || ['string', 'number', 'boolean', 'bigint'].includes(typeof expect)) {
      return formatError(inspect(expect), inspect(actual))
    }

    // dates
    if (expect instanceof Date) {
      if (!(actual instanceof Date) || +expect !== +actual) {
        return formatError(inspect(expect), inspect(actual))
      }
      return
    }

    if (actual === null) {
      const type = Object.prototype.toString.call(expect).slice(8, -1).toLowerCase()
      return formatError(`a ${type}`, 'null')
    }

    // array / object
    for (const prop in expect) {
      if (typeof actual[prop] === 'undefined' && typeof expect[prop] !== 'undefined') {
        return `expected "${prop}" field to be defined at path ${path}`
      }
      const message = checkShape(expect[prop], actual[prop], `${path}${prop}/`)
      if (message) return message
    }
  }

  Assertion.addMethod('shape', function (expect) {
    const message = checkShape(expect, this._obj, '/')
    if (message) this.assert(false, message, undefined, expect, this._obj)
  })
})

use(require('chai-as-promised'))
