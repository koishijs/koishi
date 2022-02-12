import { App } from 'vue'
import {
  ElButton,
  ElCheckbox,
  ElInput,
  ElInputNumber,
  ElLoading,
  ElMessage,
  ElRadio,
  ElScrollbar,
  ElSelect,
  ElSlider,
  ElSwitch,
  ElTooltip,
  ElTree,
  ElTable,
  ElTableColumn,
  ElPagination,
  ElPopconfirm,
  ElDatePicker,
  ElTimePicker,
} from 'element-plus'

import common from './common'
import form from './form'
import icons from './icons'
import layout from './layout'
import notice from './notice'

import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/button/style/css'
import 'element-plus/es/components/checkbox/style/css'
import 'element-plus/es/components/input/style/css'
import 'element-plus/es/components/input-number/style/css'
import 'element-plus/es/components/loading/style/css'
import 'element-plus/es/components/radio/style/css'
import 'element-plus/es/components/scrollbar/style/css'
import 'element-plus/es/components/select/style/css'
import 'element-plus/es/components/slider/style/css'
import 'element-plus/es/components/switch/style/css'
import 'element-plus/es/components/tooltip/style/css'
import 'element-plus/es/components/tree/style/css'
import 'element-plus/es/components/table/style/css'
import 'element-plus/es/components/table-column/style/css'
import 'element-plus/es/components/pagination/style/css'
import 'element-plus/es/components/popconfirm/style/css'
import 'element-plus/es/components/date-picker/style/css'
import 'element-plus/es/components/time-picker/style/css'
import './style.scss'

export const loading = ElLoading.service
export const message = ElMessage

export * from './common'
export * from './form'
export * from './icons'
export * from './layout'
export * from './notice'

export default function (app: App) {
  app.use(ElButton)
  app.use(ElCheckbox)
  app.use(ElInput)
  app.use(ElInputNumber)
  app.use(ElLoading)
  app.use(ElRadio)
  app.use(ElScrollbar)
  app.use(ElSelect)
  app.use(ElSlider)
  app.use(ElSwitch)
  app.use(ElTooltip)
  app.use(ElTree)
  app.use(ElTable)
  app.use(ElTableColumn)
  app.use(ElPagination)
  app.use(ElPopconfirm)
  app.use(ElLoading)
  app.use(ElDatePicker)
  app.use(ElTimePicker)

  app.use(common)
  app.use(form)
  app.use(icons)
  app.use(layout)
  app.use(notice)
}
