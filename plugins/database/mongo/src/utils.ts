import { Query, Eval, valueMap } from 'koishi'
import { QuerySelector } from 'mongodb'

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
  const result: QuerySelector<any> = {}
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
  const filter = {}
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
      filter['$nor'] = [transformQuery(value)]
    } else if (key === '$expr') {
      filter[key] = transformEval(value)
    } else {
      filter[key] = transformFieldQuery(value, key)
    }
  }
  return filter
}

export function transformEval(expr: Eval.Numeric | Eval.Aggregation) {
  if (typeof expr === 'string') {
    return '$' + expr
  } else if (typeof expr === 'number' || typeof expr === 'boolean') {
    return expr
  }

  return valueMap(expr as any, (value) => {
    if (Array.isArray(value)) {
      return value.map(transformEval)
    } else {
      return transformEval(value)
    }
  })
}
