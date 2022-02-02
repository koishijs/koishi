import Button from './button.vue'
import Checkbox from './checkbox.vue'
import Input from './general/input.vue'
import Switch from './general/switch.vue'
import TabItem from './tab-item.vue'
import TabGroup from './tab-group.vue'
import Radio from './radio.vue'
import Form from './schema/form.vue'
import Schema from './schema/schema.vue'
import { App } from 'vue'

export default function (app: App) {
  app.component('k-button', Button)
  app.component('k-checkbox', Checkbox)
  app.component('k-form', Form)
  app.component('k-input', Input)
  app.component('k-radio', Radio)
  app.component('k-schema', Schema)
  app.component('k-switch', Switch)
  app.component('k-tab-item', TabItem)
  app.component('k-tab-group', TabGroup)
}
