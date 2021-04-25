import ChatMessage from './components/ChatMessage.vue'
import PanelView from './components/PanelView.vue'
import Terminal from './components/Terminal.vue'
import { reactive, watch } from 'vue'
import { defineClientAppEnhance } from '@vuepress/client'

export default defineClientAppEnhance(({ app }) => {
  app.component('chat-message', ChatMessage)
  app.component('panel-view', PanelView)
  app.component('terminal', Terminal)
  const key = 'koishi.docs.config'
  const data = {
    manager: 'yarn',
    language: 'ts',
  }
  if (typeof localStorage !== 'undefined') {
    const config = localStorage.getItem(key)
    if (config) Object.assign(data, JSON.parse(config))
  }
  const storage = reactive(data)
  app.provide('$storage', storage)
  if (typeof localStorage !== 'undefined') {
    watch(storage, (val) => {
      localStorage.setItem(key, JSON.stringify(val))
    })
  }
})
