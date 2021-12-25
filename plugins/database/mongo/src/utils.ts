import { Query, valueMap } from 'koishi'
import { Filter, FilterOperators } from 'mongodb'

function transformFieldQuery(query: Query.FieldQuery, key: string) {
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
      result.$elemMatch = transformFieldQuery(query[prop], key)
    } else if (prop === '$regexFor') {
      result.$expr = {
        body(data: string, value: string) {
          return new RegExp(data, 'i').test(value)
        },
        args: ['$' + key, query],
        lang: 'js',
      }
    } else {
      result[prop] = query[prop]
    }
  }
  return result
}

export function transformQuery(query: Query.Expr) {
  const filter: Filter<any> = {}
  for (const key in query) {
    const value = query[key]
    if (key === '$and' || key === '$or') {
      // MongoError: $and/$or/$nor must be a nonempty array
      if (value.length) {
        filter[key] = value.map(transformQuery)
      } else if (key === '$or') {
        return { $nor: [{}] }
      }
    } else if (key === '$not') {
      // MongoError: unknown top level operator: $not
      // https://stackoverflow.com/questions/25270396/mongodb-how-to-invert-query-with-not
      filter.$nor = [transformQuery(value)]
    } else if (key === '$expr') {
      filter[key] = transformEval(value)
    } else {
      filter[key] = transformFieldQuery(value, key)
    }
  }
  return filter
}

function transformEvalExpr(expr: any, aggrs?: any[][]) {
  return valueMap(expr as any, (value, key) => {
    if (Array.isArray(value)) {
      return value.map(val => transformEval(val, aggrs))
    } else {
      return transformEval(value, aggrs)
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

export function transformEval(expr: any, aggrs?: any[][]) {
  if (typeof expr === 'number' || typeof expr === 'string' || typeof expr === 'boolean') {
    return expr
  } else if (expr.$) {
    return '$' + expr.$
  }

  for (const key of aggrKeys) {
    if (!expr[key]) continue
    const value = transformAggr(expr[key])
    const $ = 'temp' + aggrs.length
    if (key === '$count') {
      aggrs.push([
        { $group: { _id: value } },
        { $group: { _id: null, [$]: { $count: {} } } }
      ])
    } else {
      aggrs.push([{ $group: { _id: null, [$]: { [key]: value } } }])
    }
    return { $ }
  }

  return transformEvalExpr(expr, aggrs)
}
