export interface Config {
  prefix?: string
}

export class Storage {
  constructor(private config: Config) {
    config.prefix ||= 'koishi.database.'
  }

  async start(tables: Record<string, any[]>) {
    for (const key in localStorage) {
      if (!key.startsWith(this.config.prefix)) break
      const buffer = localStorage.getItem(key)
      if (!buffer) return
      try {
        const data = JSON.parse(buffer)
        tables[key.slice(this.config.prefix.length)] = data
      } catch {}
    }
  }

  async drop(name?: string) {
    if (name) {
      localStorage.removeItem(this.config.prefix + name)
      return
    }

    for (const key in localStorage) {
      if (key.startsWith(this.config.prefix)) {
        localStorage.removeItem(key)
      }
    }
  }

  async save(name: string, table: any[]) {
    try {
      const buffer = JSON.stringify(table)
      localStorage.setItem(this.config.prefix + name, buffer)
    } catch {}
  }
}
