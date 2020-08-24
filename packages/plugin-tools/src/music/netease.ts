import axios from 'axios'

export default async function (keyword: string) {
  const { data } = await axios.get('http://music.163.com/api/cloudsearch/pc', {
    params: { s: keyword, type: 1, offset: 0, limit: 5 },
  })
  if (data.code !== 200) return
  return {
    type: 163,
    id: data.result.songs[0].id,
  }
}
