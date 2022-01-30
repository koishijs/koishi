import { readFileSync } from 'fs'
import { basename } from 'path'
import { fromBuffer } from 'file-type'
import FormData from 'form-data'
import AggregateError from 'es-aggregate-error'
import { DiscordBot } from './bot'
import { Dict, Schema, segment } from 'koishi'

export type HandleExternalAsset = 'auto' | 'download' | 'direct'
export type HandleMixedContent = 'auto' | 'separate' | 'attach'

export namespace Sender {
  export interface Config {
    /**
     * 发送外链资源时采用的方式
     * - download：先下载后发送
     * - direct：直接发送链接
     * - auto：发送一个 HEAD 请求，如果返回的 Content-Type 正确，则直接发送链接，否则先下载后发送（默认）
     */
    handleExternalAsset?: HandleExternalAsset
    /**
     * 发送图文等混合内容时采用的方式
     * - separate：将每个不同形式的内容分开发送
     * - attach：图片前如果有文本内容，则将文本作为图片的附带信息进行发送
     * - auto：如果图片本身采用直接发送则与前面的文本分开，否则将文本作为图片的附带信息发送（默认）
     */
    handleMixedContent?: HandleMixedContent
  }
}

export class Sender {
  static Config: Schema<Sender.Config> = Schema.object({
    handleExternalAsset: Schema.union([
      Schema.const('download' as const).description('先下载后发送'),
      Schema.const('direct' as const).description('直接发送链接'),
      Schema.const('auto' as const).description('发送一个 HEAD 请求，根据返回的 Content-Type 决定发送方式'),
    ]).description('发送外链资源时采用的方式。').default('auto'),
    handleMixedContent: Schema.union([
      Schema.const('separate' as const).description('将每个不同形式的内容分开发送'),
      Schema.const('attach' as const).description('图片前如果有文本内容，则将文本作为图片的附带信息进行发送'),
      Schema.const('auto' as const).description('如果图片本身采用直接发送则与前面的文本分开，否则将文本作为图片的附带信息发送'),
    ]).description('发送图文等混合内容时采用的方式。').default('auto'),
  }).description('发送设置')

  private results: string[] = []
  private errors: Error[] = []

  private constructor(private bot: DiscordBot, private url: string) {}

  static from(bot: DiscordBot, url: string) {
    const sender = new Sender(bot, url)
    return sender.sendMessage.bind(sender)
  }

  async post(data?: any, headers?: any) {
    try {
      const result = await this.bot.http.post(this.url, data, { headers })
      this.results.push(result.id)
    } catch (e) {
      this.errors.push(e)
    }
  }

  async sendEmbed(fileBuffer: ArrayBuffer, payload_json: Dict = {}, filename: string) {
    const fd = new FormData()
    const type = await fromBuffer(fileBuffer)
    filename ||= 'file.' + type.ext
    fd.append('file', fileBuffer, filename)
    fd.append('payload_json', JSON.stringify(payload_json))
    return this.post(fd, fd.getHeaders())
  }

  async sendContent(content: string, addition: Dict) {
    return this.post({ ...addition, content })
  }

  async sendAsset(type: string, data: Dict<string>, addition: Dict) {
    const { handleMixedContent, handleExternalAsset } = this.bot.adapter.config as Sender.Config

    if (handleMixedContent === 'separate' && addition.content) {
      await this.post(addition)
      addition.content = ''
    }

    if (data.url.startsWith('file://')) {
      const filename = basename(data.url.slice(7))
      return await this.sendEmbed(readFileSync(data.url.slice(7)), addition, data.file || filename)
    } else if (data.url.startsWith('base64://')) {
      const a = Buffer.from(data.url.slice(9), 'base64')
      return await this.sendEmbed(a, addition, data.file)
    }

    const sendDirect = async () => {
      if (addition.content) {
        await this.post(addition)
      }
      return this.post({ ...addition, content: data.url })
    }

    const sendDownload = async () => {
      const filename = basename(data.url)
      const buffer = await this.bot.app.http.get<ArrayBuffer>(data.url, {
        headers: { accept: type + '/*' },
        responseType: 'arraybuffer',
      })
      return this.sendEmbed(buffer, addition, data.file || filename)
    }

    const mode = data.mode as HandleExternalAsset || handleExternalAsset
    if (mode === 'download' || handleMixedContent === 'attach' && addition.content || type === 'file') {
      return sendDownload()
    } else if (mode === 'direct') {
      return sendDirect()
    }

    // auto mode
    return await this.bot.app.http.head(data.url, {
      headers: { accept: type + '/*' },
    }).then((headers) => {
      if (headers['content-type'].startsWith(type)) {
        return sendDirect()
      } else {
        return sendDownload()
      }
    }, sendDownload)
  }

  async sendMessage(content: string, addition: Dict = {}) {
    const chain = segment.parse(content)
    let textBuffer = ''
    delete addition.content

    const sendBuffer = async () => {
      const content = textBuffer.trim()
      if (!content) return
      await this.post({ ...addition, content })
      textBuffer = ''
    }

    for (const code of chain) {
      const { type, data } = code
      if (type === 'text') {
        textBuffer += data.content.trim()
      } else if (type === 'at' && data.id) {
        textBuffer += `<@${data.id}>`
      } else if (type === 'at' && data.type === 'all') {
        textBuffer += `@everyone`
      } else if (type === 'at' && data.type === 'here') {
        textBuffer += `@here`
      } else if (type === 'sharp' && data.id) {
        textBuffer += `<#${data.id}>`
      } else if (type === 'face' && data.name && data.id) {
        textBuffer += `<:${data.name}:${data.id}>`
      } else if ((type === 'image' || type === 'video') && data.url) {
        await this.sendAsset(type, data, {
          ...addition,
          content: textBuffer.trim(),
        })
        textBuffer = ''
      } else if (type === 'share') {
        await sendBuffer()
        await this.post({
          ...addition,
          embeds: [{ ...data }],
        })
      } else if (type === 'record'){
        await this.sendAsset('file', data, {
          ...addition,
          content: textBuffer.trim(),
        })
        textBuffer = ''
      }
    }

    await sendBuffer()
    if (!this.errors.length) return this.results

    throw new AggregateError(this.errors)
  }
}
