/* eslint-disable no-undef */

import * as Vue from 'vue'
import * as Router from 'vue-router'
import * as client from '~/client'
import Badge from './components/badge.vue'
import Card from './components/card.vue'
import Collapse from './components/collapse.vue'
import Button from './components/button.vue'
import Input from './components/input.vue'
import Numeric from './components/numeric.vue'
import App from './views/layout/index.vue'

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

const stats: 'stats'[] = KOISHI_CONFIG.database ? ['stats'] : []

router.addRoute({
  path: '/',
  name: '仪表盘',
  meta: { icon: 'tachometer-alt', require: [...stats, 'meta', 'profile'] },
  component: () => import('./views/home/home.vue'),
})

router.addRoute({
  path: '/plugins',
  name: '插件',
  meta: { icon: 'plug', require: ['registry'] },
  component: () => import('./views/plugins/index.vue'),
})

router.addRoute({
  path: '/dependencies',
  name: '依赖',
  meta: { icon: 'puzzle-piece', authority: 4, require: ['registry'] },
  component: () => import('./views/dependencies/index.vue'),
})

router.addRoute({
  path: '/profile',
  name: '资料',
  meta: { icon: 'user-circle', authority: 1, hidden: true },
  component: () => import('./views/profile.vue'),
})

router.addRoute({
  path: '/login',
  name: '登录',
  meta: { icon: 'sign-in-alt', frameless: true, hidden: true },
  component: () => import('./views/login.vue'),
})

app.component('k-badge', Badge)
app.component('k-card', Card)
app.component('k-chart', Vue.defineAsyncComponent(() => import('./components/echarts')))
app.component('k-button', Button)
app.component('k-collapse', Collapse)
app.component('k-input', Input)
app.component('k-numeric', Numeric)

app.provide('ecTheme', 'dark-blue')

app.use(router)

router.beforeEach((route, from) => {
  if (from === Router.START_LOCATION && !route.matched.length) {
    loadingExtensions.then(() => router.replace(route))
  }
  if (route.meta.authority && !client.user.value) {
    return history.state.forward === '/login' ? '/' : '/login'
  }
})

router.afterEach((route) => {
  if (typeof route.name === 'string') {
    document.title = `${route.name} | ${KOISHI_CONFIG.title}`
  }
})

receive('meta', data => client.meta.value = data)
receive('profile', data => client.profile.value = data)
receive('registry', data => client.registry.value = data)
receive('stats', data => client.stats.value = data)
receive('user', data => client.user.value = data)
receive('expire', () => {
  router.push('/login')
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
