import { Context } from 'koishi'

export declare class Storage {
  constructor(ctx: Context, config: Config)

  start(tables: Record<string, any[]>): Promise<void>
  save(name: string, table: any[]): Promise<void>
  drop(name?: string): Promise<void>
}

export interface Config {
  storage?: boolean
  loader?: 'json' | 'yaml' | 'yml'
  root?: string
  prefix?: string
}
