import { use } from 'chai'

use(({ Assertion }) => {
  function sameShape(expect, actual, path) {
    if (actual === expect || Number.isNaN(expect) && Number.isNaN(actual)) return

    if (!expect || ['string', 'number', 'boolean', 'bigint'].includes(typeof expect)) {
      return 'Expected to have null but got "' + actual + '" at path "' + path + '".'
    }

    // dates
    if (expect instanceof Date) {
      if (!(actual instanceof Date)) {
        return 'Expected to have date "' + expect.toISOString() + '" but got '
          + '"' + actual + '" at path "' + path + '".'
      } else if (expect.getTime() !== actual.getTime()) {
        return 'Expected to have date "' + expect.toISOString() + '" but got ' +
          '"' + actual.toISOString() + '" at path "' + path + '".'
      }
      return
    }

    if (actual === null) {
      return 'Expected to have an array/object but got null at path "' + path + '".'
    }

    // array/object description
    for (const prop in expect) {
      if (typeof actual[prop] === 'undefined' && typeof expect[prop] !== 'undefined') {
        return 'Expected "' + prop + '" field to be defined at path "' + path + '".'
      }
      const message = sameShape(expect[prop], actual[prop], path + (path === '/' ? '' : '/') + prop)
      if (message) return message
    }
  }

  Assertion.addMethod('shape', function (expect) {
    const message = sameShape(expect, this._obj, '/')
    if (message) this.assert(false, message, undefined, expect, this._obj)
  })
})

use(require('chai-as-promised'))
