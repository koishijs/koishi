import { Query, Random, valueMap } from 'koishi'
import { Filter, FilterOperators } from 'mongodb'

function transformFieldQuery(query: Query.FieldQuery, key: string, exprs: any[]) {
  // shorthand syntax
  if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) {
    return { $eq: query }
  } else if (Array.isArray(query)) {
    if (!query.length) return
    return { $in: query }
  } else if (query instanceof RegExp) {
    return { $regex: query }
  }

  // query operators
  const result: FilterOperators<any> = {}
  for (const prop in query) {
    if (prop === '$el') {
      result.$elemMatch = transformFieldQuery(query[prop], key, exprs)
    } else if (prop === '$regexFor') {
      exprs.push({
        $function: {
          body: function (data: string, value: string) {
            return new RegExp(data, 'i').test(value)
          }.toString(),
          args: ['$' + key, query.$regexFor],
          lang: 'js',
        },
      })
    } else {
      result[prop] = query[prop]
    }
  }
  return result
}

export function transformQuery(query: Query.Expr) {
  const filter: Filter<any> = {}
  const exprs: any[] = []
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
      exprs.push(transformEval(value))
    } else {
      const query = transformFieldQuery(value, key, exprs)
      if (!query) return
      if (Object.keys(query).length) filter[key] = query
    }
  }
  if (exprs.length) {
    (filter.$and ||= []).push(...exprs.map($expr => ({ $expr })))
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
    return '$' + expr.$
  }

  for (const key of aggrKeys) {
    if (!expr[key]) continue
    const value = transformAggr(expr[key])
    const $ = Random.id()
    if (key === '$count') {
      onAggr([
        { $group: { _id: value } },
        { $group: { _id: null, [$]: { $count: {} } } }
      ])
    } else {
      onAggr([{ $group: { _id: null, [$]: { [key]: value } } }])
    }
    return { $ }
  }

  return transformEvalExpr(expr, onAggr)
}
