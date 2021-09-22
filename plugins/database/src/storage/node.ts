import type * as yaml from 'js-yaml'
import { promises as fs } from 'fs'
import { extname, resolve } from 'path'

type Loader = 'json' | 'yaml' | 'yml'
const loaders = ['json', 'yaml', 'yml']

export interface Config {
  loader?: Loader
  root?: string
}

export class Storage {
  constructor(private config: Config) {
    config.loader ||= 'json'
    config.root ||= resolve(process.cwd(), '.koishi/database')
    if (!loaders.includes(config.loader)) {
      throw new Error(`unsupported loader "${config.loader}"`)
    }
  }

  async start(tables: Record<string, any[]>) {
    const { root, loader } = this.config
    await fs.mkdir(root, { recursive: true })
    const files = await fs.readdir(root)
    await Promise.all(files.map(async (filename) => {
      const extension = extname(filename)
      if (extension !== loader) return
      const buffer = await fs.readFile(filename)
      try {
        const data = await this.load(buffer, loader)
        const name = filename.slice(0, -1 - extension.length)
        tables[name] = data
      } catch {}
    }))
  }

  async load(buffer: Buffer, loader: Loader) {
    if (loader === 'json') {
      return JSON.parse(buffer.toString())
    } else if (loader === 'yaml' || loader === 'yml') {
      const { load } = require('js-yaml') as typeof yaml
      return load(buffer.toString())
    }
  }

  async drop(name?: string) {
    const { root, loader } = this.config
    if (name) {
      await fs.rm(resolve(root, `${name}.${loader}`))
    } else {
      await fs.rm(root, { recursive: true, force: true })
    }
  }

  async save(name: string, table: any[]) {
    const { root, loader } = this.config
    try {
      const buffer = await this.dump(table, loader)
      await fs.writeFile(resolve(root, `${name}.${loader}`), buffer)
    } catch {}
  }

  async dump(data: any, loader: Loader) {
    if (loader === 'json') {
      return JSON.stringify(data)
    } else if (loader === 'yaml' || loader === 'yml') {
      const { dump } = require('js-yaml') as typeof yaml
      return dump(data)
    }
  }
}
