import { App } from 'vue'
import Form from './form.vue'
import Schema from './schema.vue'

export * from './utils'

export default function (app: App) {
  app.component('k-form', Form)
  app.component('k-schema', Schema)
}
