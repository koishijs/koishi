/* eslint-disable no-new-wrappers */

import { internal } from '@koishijs/plugin-eval/lib/worker'

internal.setGlobal('test', {
  null: null,
  undefined: undefined,
  string: 'text',
  number: 1,
  boolean: true,
  stringO: new String('text'),
  numberO: new Number(1),
  booleanO: new Boolean(true),
  date: new Date(),
  regexp: /xxx/,
  buffer: Buffer.from(Array(1000).fill(1)),
  symbol1: Symbol('test'),
  symbol2: Symbol.for('test'),
  symbol3: Symbol.iterator,
  error: new Error('test'),
  rangeError: new RangeError('test'),
  syntaxError: new SyntaxError('test'),
  referenceError: new ReferenceError('test'),
  typeError: new TypeError('test'),
  evalError: new EvalError('test'),
  uriError: new URIError('test'),
  function() {
    return () => ({})
  },
})
