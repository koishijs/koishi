import { API } from 'nhentai-api'
import { escape } from 'querystring'

interface Result {
  page: number
  perPage: number
  books: Book[]
  pages: number
}

interface Book {
  title: Record<string, string>
  id: number
  media: number
  favorites: number
  scanlator: string
  uploaded: Date
  tags: Tag[]
  cover: Image
  pages: Image[]
}

interface Tag {
  id: number
  type: {}
  name: string
  count: number
  url: string
}

interface Image {
  id: number
  width: number
  height: number
  type: []
  book: Book
}

const api = new API()

export default async function (name: string) {
  const result: Result = await api.search(escape(name))
  return result.books[0]
}
