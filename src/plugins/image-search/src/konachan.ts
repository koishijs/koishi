import axios from 'axios'
import Cheerio from 'cheerio'

export default async function konachan(url: string) {
  const { data } = await axios.get(url)
  const $ = Cheerio.load(data)
  let source = null
  $('#stats li').each((i, e) => {
    if (/^Source:/.exec($(e).text())) {
      source = $(e).find('a').attr('href')
    }
  })
  return source
}
