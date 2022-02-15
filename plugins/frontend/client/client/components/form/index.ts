import { App } from 'vue'
import Form from './form.vue'
import Schema from './schema.vue'
import Schemastery from 'schemastery'

export { Schemastery as Schema }

export default function (app: App) {
  app.component('k-form', Form)
  app.component('k-schema', Schema)
}
