import { TeachArgv } from './utils'
import axios from 'axios'

interface ImageServerStatus {
  size: number
  count: number
}

export default async function apply ({ groups, reversed, ctx, meta, config }: TeachArgv) {
  const [
    { questions, answers },
    { data: { size, count } },
  ] = await Promise.all([
    ctx.database.getDialogueCount({ groups, reversed }),
    axios.get<ImageServerStatus>(config.uploadServer + '/status'),
  ])

  return meta.$send([
    `共收录了 ${questions} 个问题和 ${answers} 个回答。`,
    `收录图片 ${count} 张，总体积 ${(size / (1 << 20)).toFixed(1)} MB。`,
  ].join('\n'))
}
