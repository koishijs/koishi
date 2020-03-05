type PackCallback <T> = T extends (...args: infer P) => infer R ? ((...args: P) => R) : never

export class Emitter <T = Record<keyof any, any[]>> {
  private _hooks: Record<keyof any, Set<(...args: any[]) => any>> = {}

  constructor () {}

  on <K extends keyof T> (name: K, callback: PackCallback<T[K]>) {
    this._hooks[name] = this._hooks[name] || new Set()
    this._hooks[name].add(callback)
    return () => this.off(name, callback)
  }

  once <K extends keyof T> (name: K, callback: PackCallback<T[K]>) {
    const unsubscribe = this.on(name, ((...args) => {
      unsubscribe()
      return callback.apply(this, args)
    }) as any)
    return unsubscribe
  }

  off <K extends keyof T> (name: K, callback: PackCallback<T[K]>) {
    return this._hooks[name].delete(callback)
  }

  emit <K extends keyof T> (name: K, ...args: Parameters<PackCallback<T[K]>>) {
    return this.parallel(name, ...args as any)
  }

  async parallel <K extends keyof T> (name: K, ...args: Parameters<PackCallback<T[K]>>) {
    if (!this._hooks[name]) return
    await Promise.all([...this._hooks[name]].map(async callback => callback.apply(this, args)))
  }

  async serial <K extends keyof T> (name: K, ...args: Parameters<PackCallback<T[K]>>) {
    if (!this._hooks[name]) return
    for (const callback of this._hooks[name]) {
      await callback.apply(this, args)
    }
  }

  async bail <K extends keyof T> (name: K, ...args: Parameters<PackCallback<T[K]>>) {
    if (!this._hooks[name]) return
    for (const callback of this._hooks[name]) {
      const result = await callback.apply(this, args)
      if (result) return result
    }
  }
}
