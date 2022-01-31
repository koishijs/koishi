import Button from './button.vue'
import Checkbox from './checkbox.vue'
import Input from './input.vue'
import TabItem from './tab-item.vue'
import TabGroup from './tab-group.vue'
import Radio from './radio.vue'
import Schema from './schema/index.vue'
import { App } from 'vue'

export default function (app: App) {
  app.component('k-button', Button)
  app.component('k-checkbox', Checkbox)
  app.component('k-input', Input)
  app.component('k-radio', Radio)
  app.component('k-schema', Schema)
  app.component('k-tab-item', TabItem)
  app.component('k-tab-group', TabGroup)
}
