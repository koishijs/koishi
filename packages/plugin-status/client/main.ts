import { createApp, h } from 'vue'
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

import '@fortawesome/fontawesome-free/css/fontawesome.css'
import '@fortawesome/fontawesome-free/css/brands.css'
import '@fortawesome/fontawesome-free/css/solid.css'

import './index.scss'

declare module 'vue-router' {
  interface RouteMeta {
    icon?: string
  }
}

const app = createApp(() => {
  return h(Layout, [h(RouterView)])
})

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: '仪表盘', meta: { icon: 'tachometer-alt' }, component: () => import('./views/home.vue') },
    { path: '/plugin', name: '插件', meta: { icon: 'plug' }, component: () => import('./views/plugin/index.vue') },
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
