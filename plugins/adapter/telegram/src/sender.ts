import { createReadStream } from 'fs'
import { Dict, Logger, segment } from 'koishi'
import * as Telegram from './types'
import AggregateError from 'es-aggregate-error'
import fileType from 'file-type'
import { TelegramBot } from '.'

const logger = new Logger('telegram')

const prefixTypes = ['quote', 'card', 'anonymous', 'markdown']

type TLAssetType =
  | 'photo'
  | 'audio'
  | 'document'
  | 'video'
  | 'animation'

async function maybeFile(payload: Dict, field: TLAssetType): Promise<[any, string?, Buffer?, string?]> {
  if (!payload[field]) return [payload]
  let content
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
  return [payload, field, content, filename]
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

const assetApi: Dict<string> = {
  photo: '/sendPhoto',
  audio: '/sendAudio',
  document: '/sendDocument',
  video: '/sendVideo',
  animation: '/sendAnimation',
}

export class Sender {
  errors: Error[] = []
  results: Telegram.Message[] = []

  currAssetType: TLAssetType = null
  payload: Dict

  constructor(private bot: TelegramBot, private chatId: string) {
    this.payload = { chatId, caption: '' }
  }

  static from(bot: TelegramBot, chatId: string) {
    const sender = new Sender(bot, chatId)
    return sender.sendMessage.bind(sender)
  }

  sendAsset = async () => {
    this.results.push(await this.bot.post(assetApi[this.currAssetType], ...await maybeFile(this.payload, this.currAssetType)))
    this.currAssetType = null
    delete this.payload[this.currAssetType]
    delete this.payload.replyToMessage
    this.payload.caption = ''
  }

  async sendMessage(content: string) {
    const segs = segment.parse(content)
    let currIdx = 0
    while (currIdx < segs.length && prefixTypes.includes(segs[currIdx].type)) {
      if (segs[currIdx].type === 'quote') {
        this.payload.replyToMessageId = segs[currIdx].data.id
      } else if (segs[currIdx].type === 'anonymous') {
        if (segs[currIdx].data.ignore === 'false') return null
      } else if (segs[currIdx].type === 'markdown') {
        this.payload.parseMode = 'MarkdownV2'
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
      this.results.push(await this.bot.get('/sendMessage', {
        chatId: this.chatId,
        text: this.payload.caption,
        replyToMessageId: this.payload.replyToMessageId,
      }))
    }

    if (!this.errors.length) return this.results.map(result => '' + result.messageId)
    throw new AggregateError(this.errors)
  }
}
