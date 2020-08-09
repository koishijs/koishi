import { Context } from 'koishi-core'
import { toDataURL } from 'qrcode'

export function apply (ctx: Context) {
  ctx.command('tools/qrcode <text...>', '生成二维码')
    .option('margin', '-m, --margin <margin>  边界尺寸', { fallback: 4 })
    .option('scale', '-s, --scale <scale>  比例系数', { fallback: 4 })
    .option('width', '-w, --width <width>  图片大小')
    .option('dark', '-d, --dark <color>  暗部颜色')
    .option('light', '-l, --light <color>  亮部颜色')
    .action(async ({ options }, text) => {
      if (!text) {
        return '请输入源文本。'
      }
      if (text.includes('[CQ:')) {
        return '称呼中禁止包含纯文本以外的内容。'
      }
      const { margin, scale, width, dark, light } = options
      const dataURL = await toDataURL(text, { margin, scale, width, color: { dark, light } })
      return `[CQ:image,file=base64://${dataURL.slice(22)}]`
    })
}
