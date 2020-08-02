import { get, Daemon, LiveInfo } from './monitor'

interface TwitCastingLive {
  host: string
  proto: string
  source: boolean
  mobilesource?: boolean
}

interface TwitCastingData {
  movie: {
    id: number
    live: boolean
  }
  hls: TwitCastingLive
  fmp4: TwitCastingLive
}

export default async function check (daemon: Daemon): Promise<LiveInfo> {
  const data = await get<TwitCastingData>(`https://twitcasting.tv/streamserver.php?target=${daemon.id}&mode=client`)
  if (!data || !data.movie || !data.movie.live) return
  return { url: `https://twitcasting.tv/${daemon.id}` }
}
