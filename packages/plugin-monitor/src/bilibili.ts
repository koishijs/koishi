import { get, Daemon, LiveInfo } from './monitor'

interface BilibiliData {
  code: number
  message: string
  ttl: number
  data: {
    roomStatus: 0 | 1
    roundStatus: 0 | 1
    liveStatus: 0 | 1
    url: string
    title: string
    cover: string
    online: number
    roomid: number
    broadcast_type: number
    online_hidden: number
  }
}

export default async function check (daemon: Daemon): Promise<LiveInfo> {
  const data = await get<BilibiliData>(`https://api.live.bilibili.com/room/v1/Room/getRoomInfoOld?mid=${daemon.id}`)
  if (!data.data || !data.data.liveStatus) return
  const { url, title, cover } = data.data
  return { url, title, image: cover }
}
