import { App } from 'koishi-core'
import { randomId } from 'koishi-utils'
import { createHmac } from 'crypto'
import { resolve } from 'path'
import { existsSync, writeFile, readdirSync, stat } from 'fs-extra'
import { Dialogue } from '../database'
import axios from 'axios'

declare module '../database' {
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

const imageRE = /\[CQ:image,file=([^,]+),url=([^\]]+)\]/

export default function apply (app: App, config: Dialogue.Config) {
  const logger = app.logger('teach')
  const { uploadKey, imagePath, imageServer, uploadPath, uploadServer } = config
  if (!imageServer) return

  app.on('dialogue/before-modify', async ({ options, meta }) => {
    let { answer } = options
    if (!answer) return
    try {
      let output = ''
      let capture: RegExpExecArray
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
      await meta.$send('上传图片时发生错误。')
      return true
    }
  })

  let downloadFile: (file: string, url: string) => Promise<void>

  if (uploadServer) {
    downloadFile = async (file, url) => {
      const params = { url, file } as any
      if (uploadKey) {
        params.salt = randomId()
        params.sign = createHmac('sha1', uploadKey).update(file + params.salt).digest('hex')
      }
      await axios.get(uploadServer, { params })
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
        await writeFile(path, data)
        totalCount += 1
        totalSize += data.byteLength
      }
    }

    const statPromise = Promise.all(fileList.map(async (file) => {
      const { size } = await stat(resolve(imagePath, file))
      totalSize += size
    }))

    app.on('connect', () => {
      app.server.koa.use(async (ctx, next) => {
        if (!ctx.path.startsWith(uploadPath)) return next()
        const { salt, sign, url, file } = ctx.query

        if (!file) {
          await statPromise
          return ctx.body = {
            count: totalCount,
            size: totalSize,
          }
        }

        if (uploadKey) {
          if (!salt || !sign) return ctx.status = 400
          const hash = createHmac('sha1', uploadKey).update(file + salt).digest('hex')
          if (hash !== sign) return ctx.status = 403
        }

        await downloadFile(file, url)
        return ctx.status = 200
      })
    })
  }
}
