/* eslint-disable no-undef */

import { createApp, defineAsyncComponent } from 'vue'
import Card from './components/card.vue'
import Collapse from './components/collapse.vue'
import Button from './components/button.vue'
import Input from './components/input.vue'
import Message from './components/message.vue'
import Numeric from './components/numeric.vue'
import ChatPanel from './components/chat-panel.vue'
import App from './views/layout/index.vue'
import { start, user, receive, router } from '~/client'

import '@fortawesome/fontawesome-free/css/fontawesome.css'
import '@fortawesome/fontawesome-free/css/brands.css'
import '@fortawesome/fontawesome-free/css/regular.css'
import '@fortawesome/fontawesome-free/css/solid.css'

import './index.scss'

const app = createApp(App)

router.addRoute({
  path: '/',
  name: '仪表盘',
  meta: { icon: 'tachometer-alt', require: ['stats', 'meta', 'profile', 'registry'] },
  component: () => import('./views/home/home.vue'),
})

router.addRoute({
  path: '/bots',
  name: '机器人',
  meta: { icon: 'robot', require: ['stats', 'profile'] },
  component: () => import('./views/bots.vue'),
})

router.addRoute({
  path: '/plugins',
  name: '插件',
  meta: { icon: 'plug', require: ['registry'] },
  component: () => import('./views/plugins/plugins.vue'),
})

router.addRoute({
  path: '/sandbox',
  name: '沙盒',
  meta: { icon: 'laptop-code', authority: 1 },
  component: () => import('./views/sandbox.vue'),
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

app.component('k-card', Card)
app.component('k-chart', defineAsyncComponent(() => import('./components/echarts')))
app.component('k-button', Button)
app.component('k-collapse', Collapse)
app.component('k-input', Input)
app.component('k-message', Message)
app.component('k-numeric', Numeric)
app.component('k-chat-panel', ChatPanel)

app.provide('ecTheme', 'dark-blue')

app.use(router)

receive('expire', () => {
  router.push('/login')
})

router.beforeEach((route) => {
  if (route.meta.authority && !user.value) {
    return history.state.forward === '/login' ? '/' : '/login'
  }
})

router.afterEach((route) => {
  if (typeof route.name === 'string') {
    document.title = `${route.name} | ${KOISHI_TITLE}`
  }
})

start()

app.mount('#app')
