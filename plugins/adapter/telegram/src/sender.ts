import { createReadStream } from 'fs'
import { Dict, Logger, segment } from 'koishi'
import * as Telegram from './types'
import AggregateError from 'es-aggregate-error'
import fileType from 'file-type'
import { TelegramBot } from '.'
import FormData from 'form-data'

const logger = new Logger('telegram')

const prefixTypes = ['quote', 'card', 'anonymous', 'markdown']

type TLAssetType =
  | 'photo'
  | 'audio'
  | 'document'
  | 'video'
  | 'animation'

async function maybeFile(payload: Dict, field: TLAssetType): Promise<[string?, Buffer?, string?]> {
  if (!payload[field]) return []
  let content: any
  let filename = 'file'
  const [schema, data] = payload[field].split('://')
  if (schema === 'file') {
    content = createReadStream(data)
    delete payload[field]
  } else if (schema === 'base64') {
    content = Buffer.from(data, 'base64')
    delete payload[field]
  }
  // add file extension for base64 document (general file)
  if (field === 'document' && schema === 'base64') {
    const type = await fileType.fromBuffer(Buffer.from(data, 'base64'))
    if (!type) {
      logger.warn('Can not infer file mime')
    } else filename = `file.${type.ext}`
  }
  return [field, content, filename]
}

async function isGif(url: string) {
  if (url.toLowerCase().endsWith('.gif')) return true
  const [schema, data] = url.split('://')
  if (schema === 'base64') {
    const type = await fileType.fromBuffer(Buffer.from(data, 'base64'))
    if (!type) {
      logger.warn('Can not infer file mime')
    } else if (type.ext === 'gif') return true
  }
  return false
}

const assetApi = {
  photo: 'sendPhoto',
  audio: 'sendAudio',
  document: 'sendDocument',
  video: 'sendVideo',
  animation: 'sendAnimation',
} as const

export class Sender {
  errors: Error[] = []
  results: Telegram.Message[] = []

  currAssetType: TLAssetType = null
  payload: Dict

  constructor(private bot: TelegramBot, private chat_id: string) {
    this.payload = { chat_id, caption: '' }
  }

  static from(bot: TelegramBot, chat_id: string) {
    const sender = new Sender(bot, chat_id)
    return sender.sendMessage.bind(sender)
  }

  sendAsset = async () => {
    const [field, content, filename] = await maybeFile(this.payload, this.currAssetType)
    const payload = new FormData()
    for (const key in this.payload) {
      payload.append(key, this.payload[key].toString())
    }
    if (field && content) payload.append(field, content, filename)
    this.results.push(await this.bot.internal[assetApi[this.currAssetType]](payload as any))
    this.currAssetType = null
    delete this.payload[this.currAssetType]
    delete this.payload.reply_to_message
    this.payload.caption = ''
  }

  async sendMessage(content: string) {
    const segs = segment.parse(content)
    let currIdx = 0
    while (currIdx < segs.length && prefixTypes.includes(segs[currIdx].type)) {
      if (segs[currIdx].type === 'quote') {
        this.payload.reply_to_message_id = segs[currIdx].data.id
      } else if (segs[currIdx].type === 'anonymous') {
        if (segs[currIdx].data.ignore === 'false') return null
      } else if (segs[currIdx].type === 'markdown') {
        this.payload.parse_mode = 'MarkdownV2'
      }
      // else if (segs[currIdx].type === 'card') {}
      ++currIdx
    }

    for (const seg of segs.slice(currIdx)) {
      switch (seg.type) {
        case 'text':
          this.payload.caption += seg.data.content
          break
        case 'at': {
          const atTarget = seg.data.name || seg.data.id || seg.data.role || seg.data.type
          if (!atTarget) break
          this.payload.caption += `@${atTarget} `
          break
        }
        case 'sharp': {
          const sharpTarget = seg.data.name || seg.data.id
          if (!sharpTarget) break
          this.payload.caption += `#${sharpTarget} `
          break
        }
        case 'face':
          logger.warn("Telegram don't support face")
          break
        case 'image':
        case 'audio':
        case 'video':
        case 'file': {
        // send previous asset if there is any
          if (this.currAssetType) await this.sendAsset()

          // handel current asset
          const assetUrl = seg.data.url

          if (!assetUrl) {
            logger.warn('asset segment with no url')
            break
          }
          if (seg.type === 'image') this.currAssetType = await isGif(assetUrl) ? 'animation' : 'photo'
          else if (seg.type === 'file') this.currAssetType = 'document'
          else this.currAssetType = seg.type
          this.payload[this.currAssetType] = assetUrl
          break
        }
        default:
          logger.warn(`Unexpected asset type: ${seg.type}`)
          return
      }
    }

    // if something left in payload
    if (this.currAssetType) await this.sendAsset()
    if (this.payload.caption) {
      this.results.push(await this.bot.internal.sendMessage({
        chat_id: this.chat_id,
        text: this.payload.caption,
        reply_to_message_id: this.payload.reply_to_message_id,
      }))
    }

    if (!this.errors.length) return this.results
    throw new AggregateError(this.errors)
  }
}
