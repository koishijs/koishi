import { createApp, h, onMounted } from 'vue'
import { ElCard, ElButton, ElCollapseTransition } from 'element-plus'
import { THEME_KEY } from 'vue-echarts'
import { createRouter, createWebHistory, RouterView } from 'vue-router'
import Card from './components/card.vue'
import Layout from './components/layout/index.vue'
import { status } from '.'

// for el-collapse-transition
import 'element-plus/lib/theme-chalk/base.css'
import 'element-plus/lib/theme-chalk/el-icon.css'
import 'element-plus/lib/theme-chalk/el-card.css'
import 'element-plus/lib/theme-chalk/el-button.css'

import './index.scss'

const app = createApp(() => {
  return h(Layout, [h(RouterView)])
})

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/home.vue') },
    { path: '/plugin', component: () => import('./views/plugin/index.vue') },
  ],
})

app.component('k-card', Card)

app.provide(THEME_KEY, 'light')

app.use(ElCard)
app.use(ElButton)
app.use(ElCollapseTransition)

app.use(router)

// eslint-disable-next-line no-undef
const socket = new WebSocket(KOISHI_ENDPOINT)
socket.onmessage = (ev) => {
  const data = JSON.parse(ev.data)
  console.log('receive', data)
  if (data.type === 'update') {
    status.value = data.body
  }
}

app.mount('#app')
