import { Dict, makeArray, Quester } from 'koishi'
import { AxiosRequestConfig } from 'axios'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export class Internal {
  static define(routes: Dict<Partial<Record<Method, string | string[]>>>) {
    for (const path in routes) {
      for (const key in routes[path]) {
        const method = key as Method
        for (const name of makeArray(routes[path][method])) {
          Internal.prototype[name] = function (this: Internal, ...args: any[]) {
            const url = path.replace(/\{([^}]+)\}/g, () => {
              if (!args.length) throw new Error('too few arguments')
              return args.shift()
            })
            const config: AxiosRequestConfig = {}
            if (args.length === 1) {
              if (method === 'GET' || method === 'DELETE') {
                config.params = args[0]
              } else {
                config.data = args[0]
              }
            } else if (args.length === 2 && method !== 'GET' && method !== 'DELETE') {
              config.data = args[0]
              config.params = args[1]
            } else {
              throw new Error('too many arguments')
            }
            return this.http(method, url, config)
          }
        }
      }
    }
  }

  constructor(private http: Quester) {}
}
