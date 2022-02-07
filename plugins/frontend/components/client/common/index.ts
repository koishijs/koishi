import { App } from 'vue'
import Button from './button.vue'
import Checkbox from './checkbox.vue'
import Input from './input.vue'
import Radio from './radio.vue'

export default function (app: App) {
  app.component('k-button', Button)
  app.component('k-checkbox', Checkbox)
  app.component('k-input', Input)
  app.component('k-radio', Radio)
}
