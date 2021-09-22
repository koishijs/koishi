import { Context, segment } from 'koishi'
import { toDataURL } from 'qrcode'

export const name = 'qrcode'

export function apply(ctx: Context) {
  ctx.command('tools/qrcode <text:text>', '生成二维码')
    .option('margin', '-m <margin>  边界尺寸', { fallback: 4 })
    .option('scale', '-s <scale>  比例系数', { fallback: 4 })
    .option('width', '-w <width>  图片大小')
    .option('dark', '-d <color>  暗部颜色')
    .option('light', '-l <color>  亮部颜色')
    .action(async ({ options }, text) => {
      if (!text) return '请输入源文本。'
      if (text.includes('[CQ:')) return '禁止输入纯文本以外的内容。'

      const { margin, scale, width, dark, light } = options
      const dataURL = await toDataURL(text, { margin, scale, width, color: { dark, light } })
      // data:image/png;base64,
      return segment.image('base64://' + dataURL.slice(22))
    })
}
