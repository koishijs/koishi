import { Context, Logger, remove, Schema, Time } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'
import { promises as fsp, mkdirSync, readdirSync } from 'fs'
import { FileHandle } from 'fs/promises'
import {} from '@koishijs/cli'

const { open, rm } = fsp

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      logs: LogProvider
    }
  }
}

class LogProvider extends DataService<string[]> {
  static using = ['console'] as const

  root: string
  date: string
  files: number[] = []
  writer: FileWriter

  constructor(ctx: Context, private config: LogProvider.Config = {}) {
    super(ctx, 'logs', { authority: 4 })

    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })

    this.ctx.on('ready', () => {
      this.prepareWriter()
      this.prepareLogger()
    }, true)
  }

  prepareWriter() {
    this.root = resolve(this.ctx.app.baseDir, this.config.root)
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

    const { maxAge } = this.config
    if (!maxAge) return

    const current = Time.getDateNumber(new Date(), 0)
    this.files = this.files.filter((date) => {
      if (date >= current - maxAge) return true
      rm(`${this.root}/${Time.template('yyyy-MM-dd', Time.fromDateNumber(date, 0))}.log`)
    })
  }

  prepareLogger() {
    if (this.ctx.app.prologue) {
      for (const line of this.ctx.app.prologue) {
        this.printText(line)
      }
      this.ctx.app.prologue = null
    }

    const target: Logger.Target = {
      colors: 3,
      showTime: 'yyyy-MM-dd hh:mm:ss',
      print: this.printText.bind(this),
    }

    Logger.targets.push(target)

    this.ctx.on('dispose', () => {
      remove(Logger.targets, target)
    })
  }

  printText(text: string) {
    if (!text.startsWith(this.date)) {
      this.writer.close()
      this.createFile()
    }
    this.writer.write(text)
    this.patch([text])
  }

  async get() {
    return this.writer?.read()
  }
}

namespace LogProvider {
  export interface Config {
    root?: string
    maxAge?: number
  }

  export const Config: Schema<Config> = Schema.object({
    root: Schema.string().default('logs').description('存放输出日志的本地目录。'),
    maxAge: Schema.natural().default(30).description('日志文件保存的最大天数。'),
  })
}

export default LogProvider

class FileWriter {
  private task: Promise<FileHandle>
  private content: string[] = []

  constructor(path: string) {
    this.task = open(path, 'a+').then(async (handle) => {
      const text = await handle.readFile('utf-8')
      if (text) this.content = text.split(/\n(?=\S)/g)
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
