import { Session } from 'koishi'
import Cheerio from 'cheerio'

export default async function danbooru(url: string, session: Session) {
  const { data } = await session.app.http.get(url)
  const $ = Cheerio.load(data)
  return $('#image-container').attr('data-normalized-source')
}
