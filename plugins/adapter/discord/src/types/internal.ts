type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export class Internal {
  static define(routes: Record<string, Partial<Record<Method, string>>>) {}
}
