import { Logger, Query, Eval } from 'koishi'
import { nextTick } from 'process'

export const logger = new Logger('level')

type QueryOperators = {
  [K in keyof Query.FieldExpr]?: (query: Query.FieldExpr[K], data: any) => boolean
}

const queryOperators: QueryOperators = {
  // logical
  $or: (query, data) => query.reduce((prev, query) => prev || executeFieldQuery(query, data), false),
  $and: (query, data) => query.reduce((prev, query) => prev && executeFieldQuery(query, data), true),
  $not: (query, data) => !executeFieldQuery(query, data),

  // comparison
  $eq: (query, data) => data.valueOf() === query.valueOf(),
  $ne: (query, data) => data.valueOf() !== query.valueOf(),
  $gt: (query, data) => data.valueOf() > query.valueOf(),
  $gte: (query, data) => data.valueOf() >= query.valueOf(),
  $lt: (query, data) => data.valueOf() < query.valueOf(),
  $lte: (query, data) => data.valueOf() <= query.valueOf(),

  // membership
  $in: (query, data) => query.includes(data),
  $nin: (query, data) => !query.includes(data),

  // regexp
  $regex: (query, data) => query.test(data),
  $regexFor: (query, data) => new RegExp(data, 'i').test(query),

  // bitwise
  $bitsAllSet: (query, data) => (query & data) === query,
  $bitsAllClear: (query, data) => (query & data) === 0,
  $bitsAnySet: (query, data) => (query & data) !== 0,
  $bitsAnyClear: (query, data) => (query & data) !== query,

  // list
  $el: (query, data) => data.some(item => executeFieldQuery(query, item)),
  $size: (query, data) => data.length === query,
}

type EvalOperators = {
  [K in keyof Eval.GeneralExpr]?: (args: Eval.GeneralExpr[K], data: any) => any
}

const evalOperators: EvalOperators = {
  // numeric
  $add: (args, data) => args.reduce<number>((prev, curr) => prev + executeEval(curr, data), 0),
  $multiply: (args, data) => args.reduce<number>((prev, curr) => prev * executeEval(curr, data), 1),
  $subtract: ([left, right], data) => executeEval(left, data) - executeEval(right, data),
  $divide: ([left, right], data) => executeEval(left, data) - executeEval(right, data),

  // boolean
  $eq: ([left, right], data) => executeEval(left, data).valueOf() === executeEval(right, data).valueOf(),
  $ne: ([left, right], data) => executeEval(left, data).valueOf() !== executeEval(right, data).valueOf(),
  $gt: ([left, right], data) => executeEval(left, data).valueOf() > executeEval(right, data).valueOf(),
  $gte: ([left, right], data) => executeEval(left, data).valueOf() >= executeEval(right, data).valueOf(),
  $lt: ([left, right], data) => executeEval(left, data).valueOf() < executeEval(right, data).valueOf(),
  $lte: ([left, right], data) => executeEval(left, data).valueOf() <= executeEval(right, data).valueOf(),

  // aggregation
  $sum: (expr, table: any[]) => table.reduce((prev, curr) => prev + executeEval(expr, curr), 0),
  $avg: (expr, table: any[]) => table.reduce((prev, curr) => prev + executeEval(expr, curr), 0) / table.length,
  $min: (expr, table: any[]) => Math.min(...table.map(data => executeEval(expr, data))),
  $max: (expr, table: any[]) => Math.max(...table.map(data => executeEval(expr, data))),
  $count: (expr, table: any[]) => new Set(table.map(data => executeEval(expr, data))).size,
}

export function executeFieldQuery(query: Query.FieldQuery, data: any) {
  // shorthand syntax
  if (Array.isArray(query)) {
    return query.includes(data)
  } else if (query instanceof RegExp) {
    return query.test(data)
  } else if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) {
    return data.valueOf() === query.valueOf()
  }

  for (const key in query) {
    if (key in queryOperators) {
      if (!queryOperators[key](query[key], data)) return false
    }
  }

  return true
}

export function executeQuery(query: Query.Expr, data: any): boolean {
  const entries: [string, any][] = Object.entries(query)
  return entries.every(([key, value]) => {
    // execute logical query
    if (key === '$and') {
      return (value as Query.Expr[]).reduce((prev, query) => prev && executeQuery(query, data), true)
    } else if (key === '$or') {
      return (value as Query.Expr[]).reduce((prev, query) => prev || executeQuery(query, data), false)
    } else if (key === '$not') {
      return !executeQuery(value, data)
    } else if (key === '$expr') {
      return executeEval(value, data)
    }

    // execute field query
    try {
      if (!(key in data)) return false
      return executeFieldQuery(value, data[key])
    } catch {
      return false
    }
  })
}

export function executeEval(expr: Eval.Any | Eval.Aggregation, data: any) {
  if (typeof expr === 'string') {
    return data[expr]
  } else if (typeof expr === 'number' || typeof expr === 'boolean') {
    return expr
  }

  for (const key in expr) {
    if (key in evalOperators) {
      return evalOperators[key](expr[key], data)
    }
  }
}

interface IAsyncTask<T> {
  factory: () => Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
}

export class AsyncQueue {
  #queue: IAsyncTask<any>[]
  #running: boolean

  constructor() {
    this.#queue = []
    this.#running = false
  }

  execute<T>(factory: () => Promise<T>): Promise<T> {
    nextTick(() => this.run())
    return new Promise<T>((resolve, reject) => this.#queue.push({ factory, resolve, reject }))
  }

  async run() {
    if (this.#running) return
    this.#running = true
    while (this.#queue.length) {
      const task = this.#queue.shift()
      await task.factory().then(task.resolve).catch(task.reject)
    }
    this.#running = false
  }
}

// export class AsyncQueue {
//   #last: Promise<any>

//   constructor() {
//     this.#last = Promise.resolve()
//   }

//   async execute<T>(factory: () => Promise<T>): Promise<T> {
//     const last = this.#last
//     return this.#last = last.catch(() => {}).finally(() => factory())
//   }
// }
