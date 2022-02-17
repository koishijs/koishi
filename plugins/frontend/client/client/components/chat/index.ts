import { App } from 'vue'
import ChatPanel from './panel.vue'
import MessageContent from './content.vue'
import VirtualList from './list.vue'

export default function (app: App) {
  app.component('k-chat-panel', ChatPanel)
  app.component('k-message-content', MessageContent)
  app.component('k-virtual-list', VirtualList)
}
