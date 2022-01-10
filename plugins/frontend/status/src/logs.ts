import { Context, Logger, Schema, Time } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'
import { resolve } from 'path'
import { mkdirSync, readdirSync, promises as fsp } from 'fs'
import { FileHandle } from 'fs/promises'

const { open, rm } = fsp

export class LogProvider extends DataSource<string[]> {
  root: string
  date: string
  files: number[] = []
  writer: FileWriter

  constructor(ctx: Context, private config: LogProvider.Config = {}) {
    super(ctx, 'logs')

    this.prepareWriter()
    this.prepareLogger()
  }

  prepareWriter() {
    this.root = resolve(this.ctx.app.baseDir, this.config.root || 'logs')
    mkdirSync(this.root, { recursive: true })

    for (const filename of readdirSync(this.root)) {
      if (!filename.endsWith('.log')) continue
      this.files.push(Time.getDateNumber(new Date(filename.slice(0, -4)), 0))
    }

    this.createFile()

    this.ctx.on('dispose', () => {
      this.writer?.close()
      this.writer = null
    })
  }

  createFile() {
    this.date = Time.template('yyyy-MM-dd')
    this.writer = new FileWriter(`${this.root}/${this.date}.log`)

    const { maxAge = 30 } = this.config
    if (!maxAge) return

    const current = Time.getDateNumber(new Date(), 0)
    this.files = this.files.filter((date) => {
      if (date >= current - maxAge) return true
      rm(`${this.root}/${Time.template('yyyy-MM-dd', Time.fromDateNumber(date, 0))}.log`)
    })
  }

  prepareLogger() {
    const print = this.printText.bind(this)

    Logger.targets.push({
      colors: 3,
      showTime: 'yyyy-MM-dd hh:mm:ss',
      print,
    })

    this.ctx.on('dispose', () => {
      const index = Logger.targets.findIndex(target => target.print === print)
      if (index >= 0) Logger.targets.splice(index, 1)
    })
  }

  printText(text: string) {
    if (!text.startsWith(this.date)) {
      this.writer.close()
      this.createFile()
    }
    this.writer.write(text)
    this.ctx.console.broadcast('logs/data', text)
  }

  async get() {
    return this.writer?.read()
  }
}

export namespace LogProvider {
  export interface Config {
    root?: string
    maxAge?: number
  }

  export const Config = Schema.object({
    root: Schema.string().description('存放输出日志的本地目录。'),
    maxAge: Schema.number().description('日志文件保存的最大天数。'),
  })
}

class FileWriter {
  private task: Promise<FileHandle>
  private content: string[]

  constructor(path: string) {
    this.task = open(path, 'a+').then(async (handle) => {
      const text = await handle.readFile('utf-8')
      this.content = text.split(/\n(?=\S)/g)
      return handle
    })
  }

  async read() {
    await this.task
    return this.content
  }

  async write(text: string) {
    const handle = await this.task
    await handle.write(text + '\n')
    this.content.push(text)
  }

  async close() {
    const handle = await this.task
    await handle.close()
  }
}
