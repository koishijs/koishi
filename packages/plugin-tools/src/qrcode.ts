import { Context } from 'koishi-core'
import { toDataURL } from 'qrcode'

export function apply (ctx: Context) {
  ctx.command('tools/qrcode <text...>', '生成二维码')
    .option('-m, --margin <margin>', '边界尺寸', { default: 4 })
    .option('-s, --scale <scale>', '比例系数', { default: 4 })
    .option('-w, --width <width>', '图片大小', { default: undefined })
    .option('-d, --dark <color>', '暗部颜色')
    .option('-l, --light <color>', '亮部颜色')
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
