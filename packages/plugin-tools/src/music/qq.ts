import axios from 'axios'

export default async function (keyword: string) {
  const { data } = await axios.get('https://c.y.qq.com/soso/fcgi-bin/client_search_cp', {
    params: { p: 1, n: 5, w: keyword, format: 'json' },
  })
  if (data.code) return
  return {
    type: 'qq',
    id: data.data.song.list[0].songid,
  }
}
