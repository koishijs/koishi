import { Random, valueMap } from 'koishi'
import { Query } from '@koishijs/orm'
import { Filter, FilterOperators } from 'mongodb'

function createFieldFilter(query: Query.FieldQuery, key: string) {
  const filters: Filter<any>[] = []
  const result: Filter<any> = {}
  const child = transformFieldQuery(query, key, filters)
  if (child === false) return false
  if (child !== true) result[key] = child
  if (filters.length) result.$and = filters
  if (Object.keys(result).length) return result
  return true
}

function transformFieldQuery(query: Query.FieldQuery, key: string, filters: Filter<any>[]) {
  // shorthand syntax
  if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) {
    return { $eq: query }
  } else if (Array.isArray(query)) {
    if (!query.length) return false
    return { $in: query }
  } else if (query instanceof RegExp) {
    return { $regex: query }
  }

  // query operators
  const result: FilterOperators<any> = {}
  for (const prop in query) {
    if (prop === '$and') {
      for (const item of query[prop]) {
        const child = createFieldFilter(item, key)
        if (child === false) return false
        if (child !== true) filters.push(child)
      }
    } else if (prop === '$or') {
      const $or: Filter<any>[] = []
      if (!query[prop].length) return false
      const always = query[prop].some((item) => {
        const child = createFieldFilter(item, key)
        if (typeof child === 'boolean') return child
        $or.push(child)
      })
      if (!always) filters.push({ $or })
    } else if (prop === '$not') {
      const child = createFieldFilter(query[prop], key)
      if (child === true) return false
      if (child !== false) filters.push({ $nor: [child] })
    } else if (prop === '$el') {
      const child = transformFieldQuery(query[prop], key, filters)
      if (child === false) return false
      if (child !== true) result.$elemMatch = child
    } else if (prop === '$regexFor') {
      filters.push({
        $expr: {
          $function: {
            body: function (data: string, value: string) {
              return new RegExp(data, 'i').test(value)
            }.toString(),
            args: ['$' + key, query.$regexFor],
            lang: 'js',
          },
        },
      })
    } else {
      result[prop] = query[prop]
    }
  }
  if (!Object.keys(result).length) return true
  return result
}

export function transformQuery(query: Query.Expr) {
  const filter: Filter<any> = {}
  const additional: Filter<any>[] = []
  for (const key in query) {
    const value = query[key]
    if (key === '$and' || key === '$or') {
      // MongoError: $and/$or/$nor must be a nonempty array
      // { $and: [] } matches everything
      // { $or: [] } matches nothing
      if (value.length) {
        filter[key] = value.map(transformQuery)
      } else if (key === '$or') {
        return
      }
    } else if (key === '$not') {
      // MongoError: unknown top level operator: $not
      // https://stackoverflow.com/questions/25270396/mongodb-how-to-invert-query-with-not
      // this may solve this problem but lead to performance degradation
      const query = transformQuery(value)
      if (query) filter.$nor = [query]
    } else if (key === '$expr') {
      additional.push({ $expr: transformEval(value) })
    } else {
      const query = transformFieldQuery(value, key, additional)
      if (query === false) return
      if (query !== true) filter[key] = query
    }
  }
  if (additional.length) {
    (filter.$and ||= []).push(...additional)
  }
  return filter
}

function transformEvalExpr(expr: any, onAggr?: (pipeline: any[]) => void) {
  return valueMap(expr as any, (value) => {
    if (Array.isArray(value)) {
      return value.map(val => transformEval(val, onAggr))
    } else {
      return transformEval(value, onAggr)
    }
  })
}

function transformAggr(expr: any) {
  if (typeof expr === 'string') {
    return '$' + expr
  }
  return transformEvalExpr(expr)
}

const aggrKeys = ['$sum', '$avg', '$min', '$max', '$count']

export function transformEval(expr: any, onAggr?: (pipeline: any[]) => void) {
  if (typeof expr === 'number' || typeof expr === 'string' || typeof expr === 'boolean') {
    return expr
  } else if (expr.$) {
    if (typeof expr.$ === 'string') {
      return '$' + expr.$
    } else {
      return '$' + expr.$[1]
    }
  }

  for (const key of aggrKeys) {
    if (!expr[key]) continue
    const value = transformAggr(expr[key])
    const $ = Random.id()
    if (key === '$count') {
      onAggr([
        { $group: { _id: value } },
        { $group: { _id: null, [$]: { $count: {} } } },
      ])
    } else {
      onAggr([{ $group: { _id: null, [$]: { [key]: value } } }])
    }
    return { $ }
  }

  return transformEvalExpr(expr, onAggr)
}
