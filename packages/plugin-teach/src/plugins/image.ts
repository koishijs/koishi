import { Context } from 'koishi-core'
import { Random } from 'koishi-utils'
import { createHmac } from 'crypto'
import { resolve } from 'path'
import { promises as fs, existsSync, readdirSync } from 'fs'
import { Dialogue } from '../utils'
import axios from 'axios'

declare module 'koishi-core/dist/app' {
  interface App {
    getImageServerStatus (): Promise<ImageServerStatus>
  }
}

declare module '../utils' {
  namespace Dialogue {
    interface Config {
      imagePath?: string
      imageServer?: string
      uploadKey?: string
      uploadPath?: string
      uploadServer?: string
    }
  }
}

interface ImageServerStatus {
  totalSize: number
  totalCount: number
}

const imageRE = /\[CQ:image,file=([^,]+),url=([^\]]+)\]/

export default function apply(ctx: Context, config: Dialogue.Config) {
  const logger = ctx.logger('teach')
  const { uploadKey, imagePath, imageServer, uploadPath, uploadServer } = config

  let downloadFile: (file: string, url: string) => Promise<void>

  if (uploadServer) {
    downloadFile = async (file, url) => {
      const params = { url, file } as any
      if (uploadKey) {
        params.salt = Random.uuid()
        params.sign = createHmac('sha1', uploadKey).update(file + params.salt).digest('hex')
      }
      await axios.get(uploadServer, { params })
    }

    ctx.app.getImageServerStatus = async () => {
      const { data } = await axios.get(uploadServer)
      return data
    }
  }

  if (imagePath && uploadPath) {
    const fileList = readdirSync(imagePath)
    let totalCount = fileList.length
    let totalSize = 0

    downloadFile = async (file, url) => {
      const path = resolve(imagePath, file)
      if (!existsSync(path)) {
        const { data } = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' })
        await fs.writeFile(path, Buffer.from(data))
        totalCount += 1
        totalSize += data.byteLength
      }
    }

    const statPromise = Promise.all(fileList.map(async (file) => {
      const { size } = await fs.stat(resolve(imagePath, file))
      totalSize += size
    }))

    const getStatus = ctx.app.getImageServerStatus = async () => {
      await statPromise
      return { totalCount, totalSize }
    }

    ctx.app.router.get(uploadPath, async (ctx) => {
      const { salt, sign, url, file } = ctx.query
      if (!file) return ctx.body = await getStatus()

      if (uploadKey) {
        if (!salt || !sign) return ctx.status = 400
        const hash = createHmac('sha1', uploadKey).update(file + salt).digest('hex')
        if (hash !== sign) return ctx.status = 403
      }

      await downloadFile(file, url)
      return ctx.status = 200
    })
  }

  if (imageServer && downloadFile) {
    ctx.on('dialogue/before-modify', async ({ options }) => {
      let { answer } = options
      if (!answer) return
      try {
        let output = ''
        let capture: RegExpExecArray
        // eslint-disable-next-line no-cond-assign
        while (capture = imageRE.exec(answer)) {
          const [text, file, url] = capture
          output += answer.slice(0, capture.index)
          answer = answer.slice(capture.index + text.length)
          await downloadFile(file, url)
          output += `[CQ:image,file=${imageServer}/${file}]`
        }
        options.answer = output + answer
      } catch (error) {
        logger.warn(error.message)
        return '上传图片时发生错误。'
      }
    })
  }
}
