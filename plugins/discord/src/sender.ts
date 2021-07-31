import { readFileSync } from 'fs'
import FormData from 'form-data'
import FileType from 'file-type'
import AggregateError from 'es-aggregate-error'
import axios from 'axios'
import { DiscordBot } from './bot'
import { segment } from 'koishi'

export type HandleExternalAsset = 'auto' | 'download' | 'direct'
export type HandleMixedContent = 'auto' | 'separate' | 'attach'

export class Sender {
  private errors: Error[] = []

  private constructor(private bot: DiscordBot, private url: string) {}

  static from(bot: DiscordBot, url: string) {
    return new Sender(bot, url).sendMessage
  }

  async post(data?: any, headers?: any) {
    try {
      const result = await this.bot.request('POST', this.url, data, headers)
      return result.id as string
    } catch (e) {
      this.errors.push(e)
    }
  }

  async sendEmbed(fileBuffer: Buffer, payload_json: Record<string, any> = {}) {
    const fd = new FormData()
    const type = await FileType.fromBuffer(fileBuffer)
    fd.append('file', fileBuffer, 'file.' + type.ext)
    fd.append('payload_json', JSON.stringify(payload_json))
    return this.post(fd, fd.getHeaders())
  }

  async sendContent(content: string, addition: Record<string, any>) {
    return this.post({ ...addition, content })
  }

  async sendAsset(type: string, data: Record<string, string>, addition: Record<string, any>) {
    const { axiosConfig, handleMixedContent, handleExternalAsset } = DiscordBot.config

    if (handleMixedContent === 'separate' && addition.content) {
      await this.post(addition)
      addition.content = ''
    }

    if (data.url.startsWith('file://')) {
      return this.sendEmbed(readFileSync(data.url.slice(8)), addition)
    } else if (data.url.startsWith('base64://')) {
      const a = Buffer.from(data.url.slice(9), 'base64')
      return await this.sendEmbed(a, addition)
    }

    const sendDirect = async () => {
      if (addition.content) {
        await this.post(addition)
      }
      return this.post({ ...addition, content: data.url })
    }

    const sendDownload = async () => {
      const a = await axios.get(data.url, {
        ...axiosConfig,
        responseType: 'arraybuffer',
        headers: {
          accept: type + '/*',
        },
      })
      return this.sendEmbed(a.data, addition)
    }

    const mode = data.mode as HandleExternalAsset || handleExternalAsset
    if (mode === 'download' || handleMixedContent === 'attach' && addition.content) {
      return sendDownload()
    } else if (mode === 'direct') {
      return sendDirect()
    }

    // auto mode
    await axios.head(data.url, {
      ...axiosConfig,
      headers: {
        accept: type + '/*',
      },
    }).then(({ headers }) => {
      if (headers['content-type'].startsWith(type)) {
        return sendDirect()
      } else {
        return sendDownload()
      }
    }, sendDownload)
  }

  sendMessage = async (content: string, addition: Record<string, any> = {}) => {
    const chain = segment.parse(content)
    let messageId = '0'
    let textBuffer = ''
    delete addition.content

    const sendBuffer = async () => {
      const content = textBuffer.trim()
      if (!content) return
      messageId = await this.post({ ...addition, content })
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
        messageId = await this.sendAsset(type, data, {
          ...addition,
          content: textBuffer.trim(),
        })
        textBuffer = ''
      } else if (type === 'share') {
        await sendBuffer()
        messageId = await this.post({
          ...addition,
          embeds: [{ ...data }],
        })
      }
    }

    await sendBuffer()
    if (!this.errors.length) return messageId

    throw new AggregateError(this.errors)
  }
}
