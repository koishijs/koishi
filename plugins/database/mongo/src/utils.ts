import { Query, Random, valueMap, omit } from 'koishi'
import { Filter, FilterOperators } from 'mongodb'

function merge(A: FilterOperators<any>, B: string | number | Document | FilterOperators<any>) {
  if (typeof B === 'string' || typeof B === 'number' || B instanceof Date) {
    return merge(A, { $eq: B })
  } else if (Array.isArray(B)) {
    if (!B.length) return
    return merge(A, { $in: B })
  } else if (B instanceof RegExp) {
    return merge(A, { $regex: B })
  }

  for (const key of Object.keys(B)) {
    if (B[key].$where) {
      merge(A, { $where: B[key].$where })
      delete B[key].$where
    }
    if (B[key].$expr?.$function) {
      merge(A, { $expr: { $function: B[key].$expr.$function } })
      delete B[key].$expr
    }
    if (!A[key]) A[key] = B[key]
    else if (key === '$and') A.$and.push(...B[key])
    else continue
    delete B[key]
  }
  if (Object.keys(B).length) {
    if (!A.$and) A.$and = []
    A.$and.push(B)
  }
  return A
}

function transformFieldQuery(query: Query.FieldQuery, key: string) {
  // shorthand syntax
  if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) {
    return query
  } else if (Array.isArray(query)) {
    if (!query.length) return
    return { $in: query }
  } else if (query instanceof RegExp) {
    return { $regex: query }
  }

  // query operators
  const result: FilterOperators<any> = {}
  if (query.$el) {
    let q = transformFieldQuery(query.$el, key)
    if (Object.keys(query.$el).length === 1) return q
    if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) q = { $eq: q }
    result.$elemMatch = q
  }
  if (query.$regexFor) {
    merge(result, {
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
  }
  if (query.$and) {
    query.$and.forEach(op => merge(result, transformFieldQuery(op, key)))
  }
  if (query.$or && query.$or.length <= 1) {
    query.$or.forEach(op => merge(result, transformFieldQuery(op, key)))
  }
  merge(result, omit(query, ['$el', '$and', '$or', '$regexFor']))
  return result
}

export function transformQuery(query: Query.Expr) {
  const filter: Filter<any> = {}
  for (const key in query) {
    const value = query[key]
    if (key === '$and') {
      value.forEach(op => merge(filter, transformQuery(op)))
    } else if (key === '$or') {
      if (value.length === 1) merge(filter, transformQuery(value[0]))
      else if (value.length) merge(filter, { $or: value.map(transformQuery) })
      else return { _id: null }
    } else if (key === '$not') {
      // MongoError: unknown top level operator: $not
      // https://stackoverflow.com/questions/25270396/mongodb-how-to-invert-query-with-not
      merge(filter, { $nor: [transformQuery(value)] })
    } else if (key === '$expr') {
      merge(filter, { $expr: transformEval(value) })
    } else {
      merge(filter, { [key]: transformFieldQuery(value, key) })
    }
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
        { $group: { _id: null, [$]: { $count: {} } } },
      ])
    } else {
      onAggr([{ $group: { _id: null, [$]: { [key]: value } } }])
    }
    return { $ }
  }

  return transformEvalExpr(expr, onAggr)
}
