import { App } from 'vue'
import {
  ElInput,
  ElInputNumber,
  ElEmpty,
  ElTooltip,
  ElScrollbar,
  ElSelect,
  ElSlider,
  ElSwitch,
  ElTree,
} from 'element-plus'

import common from './common'
import form from './form'
import icons from './icons'
import layout from './layout'
import notice from './notice'

export { ElMessage as message } from 'element-plus'

export * from './common'
export * from './form'
export * from './icons'
export * from './layout'
export * from './notice'

export default function (app: App) {
  app.use(ElInput)
  app.use(ElInputNumber)
  app.use(ElEmpty)
  app.use(ElTooltip)
  app.use(ElScrollbar)
  app.use(ElSelect)
  app.use(ElSlider)
  app.use(ElSwitch)
  app.use(ElTree)

  app.use(common)
  app.use(form)
  app.use(icons)
  app.use(layout)
  app.use(notice)
}
