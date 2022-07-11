import Schema from 'schemastery'
import { clone } from 'cosmokit'

export * from 'cosmokit'
export { Schema }

const primitive = ['string', 'number', 'boolean', 'const']
const dynamic = ['function', 'transform']
const composite = ['array', 'dict']

export function isObjectSchema(schema: Schema) {
  if (schema.type === 'object') {
    return true
  } else if (schema.type === 'intersect') {
    return schema.list.every(isObjectSchema)
  } else if (schema.type === 'union') {
    return getChoices(schema).every(isObjectSchema)
  } else {
    return false
  }
}

export function getChoices(schema: Schema) {
  return schema.list.filter(item => !item.meta.hidden && !dynamic.includes(item.type))
}

export function getFallback(schema: Schema, required = false) {
  if (!schema || schema.type === 'union' && getChoices(schema).length === 1) return
  return clone(schema.meta.default) ?? (required ? inferFallback(schema) : undefined)
}

export function inferFallback(schema: Schema) {
  if (schema.type === 'string') return ''
  if (schema.type === 'number') return 0
  if (schema.type === 'boolean') return false
  if (['dict', 'object', 'intersect'].includes(schema.type)) return {}
}

export function validate(schema: Schema): boolean {
  if (!schema || schema.meta.hidden) return true
  if (schema.type === 'object') {
    return Object.values(schema.dict).every(validate)
  } else if (schema.type === 'intersect') {
    return schema.list.every(isObjectSchema)
  } else if (schema.type === 'union') {
    const choices = getChoices(schema)
    return choices.length === 1 || choices.every(item => validate(item))
  } else if (composite.includes(schema.type)) {
    return validate(schema.inner)
  } else {
    return primitive.includes(schema.type)
  }
}

export function hasTitle(schema: Schema, root?: boolean) {
  if (!schema) return true
  if (schema.type === 'object') {
    if (schema.meta.description) return true
    const keys = Object.keys(schema.dict)
    if (!keys.length) return true
    return hasTitle(schema.dict[keys[0]])
  } else if (schema.type === 'intersect') {
    return hasTitle(schema.list[0])
  } else if (schema.type === 'union') {
    const choices = schema.list.filter(item => !dynamic.includes(item.type))
    return choices.length === 1 ? hasTitle(choices[0]) : false
  } else if (root && composite.includes(schema.type) && validate(schema.inner)) {
    return true
  } else {
    return false
  }
}

export function deepEqual(a: any, b: any) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  if (!a || !b) return false

  // check array
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  } else if (Array.isArray(b)) {
    return false
  }

  // check object
  return Object.keys({ ...a, ...b }).every(key => deepEqual(a[key], b[key]))
}
