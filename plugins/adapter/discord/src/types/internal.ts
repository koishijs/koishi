import { Quester } from 'koishi'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export class Internal {
  static define(routes: Record<string, Partial<Record<Method, string>>>) {
    for (const path in routes) {
      for (const method in routes[path]) {
        const name = routes[path][method]
        Internal.prototype[name] = function (this: Internal, ...args: any[]) {
          const url = path.replace(/\{([^}]+)\}/g, () => args.shift())
          return this.http(method as any, url)
        }
      }
    }
  }

  constructor(private http: Quester) {}
}
