import { App } from 'vue'
import ExternalLink from './external-link.vue'
import EyeSlash from './eye-slash.vue'
import Eye from './eye.vue'

export default function (app: App) {
  app.component('k-icon-external-link', ExternalLink)
  app.component('k-icon-eye-slash', EyeSlash)
  app.component('k-icon-eye', Eye)
}
