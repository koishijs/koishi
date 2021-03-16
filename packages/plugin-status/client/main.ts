import { createApp } from 'vue'
import { ElButton, ElCollapseTransition } from 'element-plus'
import { THEME_KEY } from 'vue-echarts'
import { createRouter, createWebHistory } from 'vue-router'
import Card from './components/card.vue'
import CardNumeric from './components/card-numeric.vue'
import App from './views/layout/index.vue'
import { status } from '.'

// for el-collapse-transition
import 'element-plus/lib/theme-chalk/base.css'
import 'element-plus/lib/theme-chalk/el-icon.css'
import 'element-plus/lib/theme-chalk/el-button.css'

import '@fortawesome/fontawesome-free/css/fontawesome.css'
import '@fortawesome/fontawesome-free/css/brands.css'
import '@fortawesome/fontawesome-free/css/solid.css'

import './index.scss'

declare module 'vue-router' {
  interface RouteMeta {
    icon?: string
    status?: boolean
  }
}

const app = createApp(App)

const router = createRouter({
  history: createWebHistory(),
  routes: [{
    path: '/',
    name: '仪表盘',
    meta: { icon: 'tachometer-alt' },
    component: () => import('./views/home/index.vue'),
  }, {
    path: '/bots',
    name: '机器人',
    meta: { icon: 'robot' },
    component: () => import('./views/bots.vue'),
  }, {
    path: '/plugins',
    name: '插件',
    meta: { icon: 'plug' },
    component: () => import('./views/plugins/index.vue'),
  }],
})

app.component('k-card', Card)
app.component('k-card-numeric', CardNumeric)

app.provide(THEME_KEY, 'light')

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
