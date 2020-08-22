/* eslint-disable camelcase */

import { get, Daemon, LiveInfo } from './monitor'

interface MirrativStatus {
  msg: string
  ok: number
  error: string
  captcha_url: string
  error_code: number
  message: string
}

interface MirrativUser {
  share_url: string
  profile_image_url: string
  name: string
  description: string
  properties: []
  badges: []
  is_continuous_streamer: number
  is_new: number
  user_id: string
  live_request_num: string
  onlive: {
    live_id: string
  }
}

interface MirrativUserData extends MirrativUser {
  current_continuous_record: number
  custom_thanks_message: string
  registered_at: string
  follower_num: string
  my_app_num: number
  links: {
    url: string
  }[]
  grade_id: number
  twitter_screen_name: string
  total_viewer_num: number
  live_announcement: null
  is_blocked: number
  is_blocking: number
  paypal_username: string
  status: MirrativStatus
  ribbons: []
  following_num: string
  kakao_name: string
  is_follower: number
  max_continuous_record: string
  chat_enabled: number
  is_following: number
}

interface MirrativLiveData {
  streaming_url_hls: string
  is_gift_supported: number
  live_id: string
  is_mirrorable: number
  description: string
  total_viewer_num: number
  thumbnail_image_url: string
  is_archive: number
  is_singing_karaoke: number
  title: string
  max_online_viewer_num: number
  created_at: number
  is_live: number
  started_at: number
  preview_blur_image_url: string
  live_mos: null
  image_url_without_letterbox: string
  thumbnail_blur_image_url: string
  joined_live_thumbnail_image_url: string
  template_comments: []
  tags: []
  broadcast_host: string
  live_user_key: string
  bcsvr_key: string
  heartbeated_at: string
  shares: {
    twitter: {
      maxlength: number
      card: {
        site: string
        image_url: string
        title: string
        description: string
      }
      text: string
      placeholder: string
    }
    others: {
      text: string
    }
    title: string
    description: string
  }
  is_private: number
  collab_supported: number
  sticker_enabled: number
  collab_has_vacancy: number
  streaming_key: string
  stamp_num: number
  linked_live: null
  collab_online_user_num: string
  broadcast_key: string
  gift_ranking_url: string
  collab_mos: null
  archive_url_hls: string
  remaining_coins: number
  ended_at: number
  sticker_category_ids: string[]
  online_user_num: number
  announcement_url: string
  share_url: string
  status: MirrativStatus
  orientation: string
  app_id: string
  is_muted: string
  app_icon_urls: string[]
  timeline: {
    app: {
      is_my_app: number
      icon_url: string
      store_url: string
      app_id: string
      id: string
      title: string
      is_category: string
    }
    timestamp: string
    title: string
  }[]
  is_paid_sticker_supported: number
  announcement_urls: null
  sticker_num: string
  max_collab_user_num: string
  comment_num: number
  owner: MirrativUser
  broadcast_port: number
  recommend_sticker_ids: string[]
  sticker_display_type: string
  archive_comment_enabled: number
  streaming_url_edge: string
  collab_enabled: string
  image_url: string
  orientation_v2: string
}

export default async function check(daemon: Daemon): Promise<LiveInfo> {
  const user = await get<MirrativUserData>(`https://www.mirrativ.com/api/user/profile?user_id=${daemon.id}`)
  if (!user || !user.onlive) return
  const live = await get<MirrativLiveData>(`https://www.mirrativ.com/api/live/live?live_id=${user.onlive.live_id}`)
  if (!live) return
  return { url: `https://www.mirrativ.com/live/${live.live_id}`, title: live.title, image: live.image_url }
}
