import { noop } from 'koishi'
import { promises as fsp } from 'fs'
import { join } from 'path'
import JsdelivrAssets from './index'

const { unlink } = fsp

declare module 'koishi' {
  interface Tables {
    jsdelivr: File
  }
}

export interface FileInfo {
  hash: string
  name: string
  size: number
}

export interface File extends FileInfo {
  id: number
  branch: number
}

export interface Task extends File {}

export class Task {
  constructor(private assets: JsdelivrAssets, file: FileInfo) {
    Object.assign(this, file)
  }

  public resolvers: ((data: string) => void)[]
  public rejectors: ((reason: any) => void)[]

  get filename() {
    return `${this.hash}${this.name}`
  }

  get tempPath() {
    return join(this.assets.config.tempDir, this.hash)
  }

  get savePath() {
    return join(this.assets.config.git.baseDir, this.filename)
  }

  resolve() {
    const url = this.assets.toPublicUrl(this)
    for (const callback of this.resolvers) {
      callback(url)
    }
  }

  async reject(error: any) {
    for (const callback of this.rejectors) {
      callback(error)
    }
    await Promise.all([
      unlink(this.tempPath).catch(noop),
      unlink(this.savePath).catch(noop),
    ])
  }
}
