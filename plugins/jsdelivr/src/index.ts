import { Context, Assets, Schema, Tables, Logger } from 'koishi'
import Git, { SimpleGit, SimpleGitOptions, ResetMode } from 'simple-git'
import { access, mkdir } from 'fs/promises'
import { join } from 'path'

declare module 'koishi' {
  interface Tables {
    jsdelivr: JsdelivrFile
  }
}

export interface JsdelivrFile {
  id: number
  hash: string
  name: string
  branch: number
  size: number
}

export interface JsdelivrBranch {
  branch: number
  size: number
}

Tables.extend('jsdelivr', {
  id: 'integer',
  hash: 'string',
  name: 'string',
  branch: 'integer',
  size: 'integer',
}, {
  autoInc: true,
})

export interface Config {
  githubUser: string
  githubRepo: string
  githubToken: string
  git: Partial<SimpleGitOptions>
  maxBranchSize?: number
}

export const schema: Schema<Config> = Schema.object({
  githubUser: Schema.string(),
  githubRepo: Schema.string(),
  githubToken: Schema.string(),
  git: Schema.object({
    baseDir: Schema.string().required(),
  }, true),
  maxBranchSize: Schema.number().default(50 * 1024 * 1024),
})

const logger = new Logger('jsdelivr')

class JsdelivrAssets implements Assets {
  types = ['image', 'audio', 'video', 'file'] as const
  git: SimpleGit

  constructor(private ctx: Context, private config: Config) {}

  log(text: string) {
    this.ctx.logger('jsdelivr').debug(text)
  }

  async initRepo() {
    const { git, githubRepo, githubToken, githubUser } = this.config
    try {
      await access(join(git.baseDir, '.git'))
      this.git = Git(this.config.git)
    } catch (e) {
      logger.debug(`initializing repo at ${git.baseDir} ...`)
      await mkdir(git.baseDir, { recursive: true })
      this.git = Git(this.config.git)
      await this.git
        .init()
        .addRemote('origin', `https://${githubToken}@github.com/${githubUser}/${githubRepo}.git`)
        .addConfig('core.autocrlf', 'false', false)
      await this.checkout(false, true)
      logger.debug('repository is initialized successfully')
    }
  }

  branchName(id: number) {
    return id.toString(36).padStart(8)
  }

  async checkout(forceNew?: boolean, fetch?: boolean, offset = 1): Promise<JsdelivrBranch> {
    const res = await this.getLatestBranch(forceNew, offset)
    const branchName = this.branchName(res.branch)
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

  private async getLatestBranch(forceNew?: boolean, offset = 1): Promise<JsdelivrBranch> {
    const [file] = await this.ctx.database.get('jsdelivr', {}, {
      // order: { id: 'desc' },
      fields: ['branch'],
      limit: 1,
    })
    if (!file) return { branch: offset, size: 0 }
    const { branch } = file
    if (forceNew) return { branch: branch + offset, size: 0 }
    const { size } = await this.ctx.database.aggregate('jsdelivr', {
      size: { $sum: 'size' },
    }, { branch: file.branch })
    if (size >= this.config.maxBranchSize) {
      logger.debug(`will switch to branch ${this.branchName(branch)}`)
      return { branch: branch + offset, size: 0 }
    } else {
      logger.debug(`will remain on branch ${this.branchName(branch)}`)
      return { branch, size }
    }
  }

  async upload() {}

  async stats() {}
}

export const name = 'jsdelivr'

export function apply(ctx: Context, config: Config) {
  config = Schema.validate(config, schema)
  ctx.assets = new JsdelivrAssets(ctx, config)
}
