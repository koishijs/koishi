/* eslint-disable no-undef */

import * as Vue from 'vue'
import * as Router from 'vue-router'
import * as client from './index'
import Badge from './components/badge.vue'
import Card from './components/card.vue'
import Collapse from './components/collapse.vue'
import Button from './components/button.vue'
import Checkbox from './components/checkbox.vue'
import Input from './components/input.vue'
import Numeric from './components/numeric.vue'
import App from './views/layout/index.vue'
import Schema from './components/schema/index.vue'
import { ElRadio } from 'element-plus'

import '@fortawesome/fontawesome-free/css/fontawesome.css'
import '@fortawesome/fontawesome-free/css/brands.css'
import '@fortawesome/fontawesome-free/css/regular.css'
import '@fortawesome/fontawesome-free/css/solid.css'

import './index.scss'

const { router, receive } = client

self['Vue'] = Vue
self['VueRouter'] = Router
self['KoishiClient'] = client

const app = Vue.createApp(App)

app.use(ElRadio)

const stats: 'stats'[] = KOISHI_CONFIG.database ? ['stats'] : []

router.addRoute({
  path: '/',
  name: '仪表盘',
  meta: { icon: 'tachometer-alt', require: [...stats, 'meta', 'profile'] },
  component: () => import('./views/home/home.vue'),
})

router.addRoute({
  path: '/bots',
  name: '机器人',
  meta: { icon: 'robot' },
  component: () => import('./views/bots/index.vue'),
})

router.addRoute({
  path: '/database',
  name: '数据库',
  meta: { icon: 'database' },
  component: () => import('./views/database/index.vue'),
})

router.addRoute({
  path: '/config',
  name: '配置项',
  meta: { icon: 'tools', require: ['registry'] },
  component: () => import('./views/config/index.vue'),
})

router.addRoute({
  path: '/market',
  name: '插件市场',
  meta: { icon: 'puzzle-piece', require: ['market'] },
  component: () => import('./views/market/index.vue'),
})

router.addRoute({
  path: '/logs',
  name: '运行日志',
  meta: { icon: 'clipboard-list' },
  component: () => import('./views/logs/index.vue'),
})

app.component('k-badge', Badge)
app.component('k-checkbox', Checkbox)
app.component('k-card', Card)
app.component('k-chart', Vue.defineAsyncComponent(() => import('./components/echarts')))
app.component('k-button', Button)
app.component('k-collapse', Collapse)
app.component('k-input', Input)
app.component('k-numeric', Numeric)
app.component('k-schema', Schema)

app.provide('ecTheme', 'dark-blue')

app.use(router)

router.beforeEach((route, from) => {
  if (from === Router.START_LOCATION && !route.matched.length) {
    loadingExtensions.then(() => router.replace(route))
  }
})

router.afterEach((route) => {
  if (typeof route.name === 'string') {
    document.title = `${route.name} | Koishi 控制台`
  }
})

receive('meta', data => client.meta.value = data)
receive('market', data => client.market.value = data)
receive('profile', data => client.profile.value = data)
receive('registry', data => client.registry.value = data)
receive('stats', data => client.stats.value = data)
receive('user', data => client.user.value = data)

function connect() {
  const endpoint = new URL(KOISHI_CONFIG.endpoint, location.origin).toString()
  const socket = client.socket.value = new WebSocket(endpoint.replace(/^http/, 'ws'))

  socket.onmessage = (ev) => {
    const data = JSON.parse(ev.data)
    console.debug(data)
    if (data.type in client.listeners) {
      client.listeners[data.type](data.body)
    }
  }

  socket.onopen = () => {
    if (!client.user.value) return
    const { id, token } = client.user.value
    client.send('validate', { id, token })
  }

  socket.onclose = () => {
    console.log('[koishi] websocket disconnected, will retry in 1s...')
    setTimeout(connect, 1000)
  }
}

connect()

const loadingExtensions = Promise.all(KOISHI_CONFIG.extensions.map(path => {
  return import(/* @vite-ignore */ path)
}))

loadingExtensions.then(() => app.mount('#app'))
