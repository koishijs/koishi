import { App } from 'vue'
import common from './common'
import form from './form'
import icons from './icons'
import layout from './layout'
import notice from './notice'

export * from './common'
export * from './form'
export * from './icons'
export * from './layout'
export * from './notice'

export default function (app: App) {
  app.use(common)
  app.use(form)
  app.use(icons)
  app.use(layout)
  app.use(notice)
}
