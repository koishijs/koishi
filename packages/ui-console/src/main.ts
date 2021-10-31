/* eslint-disable no-undef */

import * as Vue from 'vue'
import * as Router from 'vue-router'
import * as client from './index'

import form from './components/form'

import Badge from './components/notice/badge.vue'
import Comment from './components/notice/comment.vue'
import Hint from './components/notice/hint.vue'
import Content from './components/layout/content.vue'
import CardAside from './components/layout/card-aside.vue'
import Card from './components/card.vue'
import Collapse from './components/collapse.vue'
import Numeric from './components/numeric.vue'
import App from './layout/index.vue'

import { ElCascader, ElEmpty, ElTooltip, ElScrollbar } from 'element-plus'

import '@fortawesome/fontawesome-free/css/fontawesome.css'
import '@fortawesome/fontawesome-free/css/brands.css'
import '@fortawesome/fontawesome-free/css/regular.css'
import '@fortawesome/fontawesome-free/css/solid.css'

import './index.scss'
import 'element-plus/dist/index.css'

const { router } = client

self['Vue'] = Vue
self['VueRouter'] = Router
self['KoishiClient'] = client

const app = Vue.createApp(App)

app.use(ElCascader)
app.use(ElEmpty)
app.use(ElTooltip)
app.use(ElScrollbar)

// notice
app.component('k-badge', Badge)
app.component('k-comment', Comment)
app.component('k-hint', Hint)

app.use(form)

app.component('k-content', Content)
app.component('k-card-aside', CardAside)
app.component('k-card', Card)
app.component('k-chart', Vue.defineAsyncComponent(() => import('./components/echarts')))
app.component('k-collapse', Collapse)
app.component('k-numeric', Numeric)

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
