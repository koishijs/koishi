import { $, Assets, Context, Logger, Schema, sleep, Time } from 'koishi'
import Git, { ResetMode, SimpleGit, SimpleGitOptions } from 'simple-git'
import { promises as fsp } from 'fs'
import { join, resolve } from 'path'
import { File, FileInfo, Task } from './file'

const { access, mkdir, rename, writeFile } = fsp

export interface Branch {
  branch: number
  size: number
}

function toBranchName(id: number) {
  return id.toString(36).padStart(8)
}

const logger = new Logger('jsdelivr')

class JsdelivrAssets extends Assets {
  static using = ['database'] as const

  git: SimpleGit
  taskQueue: Task[] = []
  taskMap = new Map<string, Task>()
  isActive = false

  constructor(ctx: Context, public config: JsdelivrAssets.Config) {
    super(ctx)

    ctx.model.extend('jsdelivr', {
      id: 'integer',
      hash: 'string',
      name: 'string',
      branch: 'integer',
      size: 'integer',
    }, {
      autoInc: true,
    })
  }

  async start() {
    await this.initRepo()
    this.isActive = true
    while (this.isActive) {
      try {
        await this.mainLoop()
      } catch (e) {
        logger.warn(`Loop failed: ${e.toString()}`)
      }
    }
  }

  stop() {
    this.isActive = false
  }

  private async initRepo() {
    const { git, github: { user, repo, token } } = this.config
    try {
      await access(join(git.baseDir, '.git'))
      this.git = Git(this.config.git)
    } catch (e) {
      logger.debug(`initializing repo at ${git.baseDir} ...`)
      await mkdir(git.baseDir, { recursive: true })
      this.git = Git(this.config.git)
      await this.git
        .init()
        .addRemote('origin', `https://${token}@github.com/${user}/${repo}.git`)
        .addConfig('core.autocrlf', 'false', false)
      await this.checkout(false, true)
      logger.debug('repository is initialized successfully')
    }
  }

  private async getBranch(forceNew?: boolean, offset = 1): Promise<Branch> {
    const [file] = await this.ctx.database.get('jsdelivr', {}, {
      sort: { id: 'desc' },
      fields: ['branch'],
      limit: 1,
    })
    if (!file) return { branch: offset, size: 0 }
    const { branch } = file
    if (forceNew) return { branch: branch + offset, size: 0 }

    const size = await this.ctx.database
      .select('jsdelivr', { branch: file.branch })
      .evaluate(row => $.sum(row.size))
      .execute()
    if (size >= this.config.maxBranchSize) {
      logger.debug(`will switch to branch ${toBranchName(branch)}`)
      return { branch: branch + offset, size: 0 }
    } else {
      logger.debug(`will remain on branch ${toBranchName(branch)}`)
      return { branch, size }
    }
  }

  private async checkout(forceNew?: boolean, fetch?: boolean, offset = 1): Promise<Branch> {
    const res = await this.getBranch(forceNew, offset)
    const branchName = toBranchName(res.branch)
    if (!res.size) {
      logger.debug(`Checking out to a new branch ${branchName}`)
      await this.git.checkout(['--orphan', branchName])
      await this.git.raw(['rm', '-rf', '.'])
      logger.debug(`Checked out to a new branch ${branchName}`)
    } else {
      logger.debug(`Checking out existing branch ${branchName}`)
      if (fetch) {
        await this.git.fetch('origin', branchName)
      }
      await this.git.checkout(branchName, ['-f'])
      if (fetch) {
        await this.git.reset(ResetMode.HARD, [`origin/${branchName}`])
      }
      logger.debug(`Checked out existing branch ${branchName}`)
    }
    return res
  }

  private async createTask(file: FileInfo) {
    return new Promise<string>((resolve, reject) => {
      let task = this.taskMap.get(file.hash)
      if (!task) {
        task = new Task(this, file)
        this.taskQueue.push(task)
        this.taskMap.set(file.hash, task)
      }
      task.resolvers.push(resolve)
      task.rejectors.push(reject)
    })
  }

  private getTasks(available: number) {
    const tasks: Task[] = []
    let size = 0
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue[0]
      size += task.size
      if (size > available) break
      this.taskQueue.shift()
      tasks.push(task)
    }
    return tasks
  }

  private async mainLoop() {
    if (!this.taskQueue.length) {
      return sleep(this.config.flushInterval)
    }

    logger.debug(`Processing files.`)
    let branch = await this.checkout()
    let tasks = this.getTasks(this.config.maxBranchSize - branch.size)
    if (!tasks.length) {
      branch = await this.checkout(true)
      tasks = this.getTasks(this.config.maxBranchSize)
    }
    if (!tasks.length) return

    logger.debug(`Will process ${tasks.length} files.`)
    try {
      logger.debug(`Moving files.`)
      await Promise.all(tasks.map(async (task) => {
        task.branch = branch.branch
        await rename(task.tempPath, task.savePath)
      }))
      logger.debug(`Committing files.`)
      await this.git
        .add(tasks.map(task => task.filename))
        .commit('upload')
        .push('origin', toBranchName(branch.branch), ['-u', '-f'])
      logger.debug(`Saving file entries to database.`)
      await this.ctx.database.upsert('jsdelivr', tasks)
      logger.debug(`Finished processing files.`)
      for (const task of tasks) {
        task.resolve()
      }
    } catch (e) {
      logger.warn(`Errored processing files: ${e.toString()}`)
      await Promise.all(tasks.map(task => task.reject(e)))
    } finally {
      for (const file of tasks) {
        this.taskMap.delete(file.hash)
      }
    }
  }

  toPublicUrl(file: File) {
    const { user, repo } = this.config.github
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${file.branch}/${file.hash}-${file.name}`
  }

  async upload(url: string, _file?: string) {
    const { buffer, hash, name } = await this.analyze(url, _file)
    const [file] = await this.ctx.database.get('jsdelivr', { hash })
    if (file) return this.toPublicUrl(file)
    await writeFile(join(this.config.tempDir, hash), buffer)
    return this.createTask({ size: buffer.byteLength, hash, name })
  }

  async stats() {
    const selection = this.ctx.database.select('jsdelivr')
    const [assetCount, assetSize] = await Promise.all([
      selection.evaluate(row => $.count(row.id)).execute(),
      selection.evaluate(row => $.sum(row.size)).execute(),
    ])
    return { assetCount, assetSize }
  }
}

namespace JsdelivrAssets {
  export interface GitHubConfig {
    user: string
    repo: string
    token: string
  }

  const GitHubConfig = Schema.object({
    user: Schema.string().required(),
    repo: Schema.string().required(),
    token: Schema.string().role('secret').required(),
  })

  export interface Config {
    git: Partial<SimpleGitOptions>
    github: GitHubConfig
    tempDir?: string
    flushInterval?: number
    maxBranchSize?: number
  }

  export const Config: Schema<Config> = Schema.object({
    github: GitHubConfig,
    git: Schema.object({
      baseDir: Schema.string().required(),
    }),
    tempDir: Schema.string().default(resolve(__dirname, '../.temp')),
    flushInterval: Schema.natural().role('ms').default(Time.second * 3),
    maxBranchSize: Schema.natural().role('byte').default(50 * 1024 * 1024),
  })
}

export default JsdelivrAssets
