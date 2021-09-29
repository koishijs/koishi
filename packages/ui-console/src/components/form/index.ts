import Button from './button.vue'
import Checkbox from './checkbox.vue'
import Input from './input.vue'
import TabItem from './tab-item.vue'
import Radio from './radio.vue'
import Schema from './schema.vue'
import { App } from 'vue'

export default function (app: App) {
  app.component('k-button', Button)
  app.component('k-checkbox', Checkbox)
  app.component('k-input', Input)
  app.component('k-tab-item', TabItem)
  app.component('k-radio', Radio)
  app.component('k-schema', Schema)
}
