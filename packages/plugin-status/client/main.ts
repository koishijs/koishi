/* eslint-disable no-undef */

import { createApp, defineAsyncComponent } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import Card from './components/card.vue'
import Collapse from './components/collapse.vue'
import Button from './components/button.vue'
import Input from './components/input.vue'
import App from './views/layout/index.vue'
import { start, user, receive } from '.'

import '@fortawesome/fontawesome-free/css/fontawesome.css'
import '@fortawesome/fontawesome-free/css/brands.css'
import '@fortawesome/fontawesome-free/css/regular.css'
import '@fortawesome/fontawesome-free/css/solid.css'

import './index.scss'

declare module 'vue-router' {
  interface RouteMeta {
    icon?: string
    hidden?: boolean
    authorize?: boolean
    frameless?: boolean
    require?: ('stats' | 'profile' | 'registry')[]
  }
}

const app = createApp(App)

const router = createRouter({
  history: createWebHistory(KOISHI_UI_PATH),
  routes: [{
    path: '/',
    name: '仪表盘',
    meta: { icon: 'tachometer-alt', require: ['stats', 'profile', 'registry'] },
    component: () => import('./views/home/home.vue'),
  }, {
    path: '/bots',
    name: '机器人',
    meta: { icon: 'robot', require: ['stats', 'profile'] },
    component: () => import('./views/bots.vue'),
  }, {
    path: '/plugins',
    name: '插件',
    meta: { icon: 'plug', require: ['registry'] },
    component: () => import('./views/plugins/plugins.vue'),
  }, {
    path: '/sandbox',
    name: '沙盒',
    meta: { icon: 'laptop-code', authorize: true },
    component: () => import('./views/sandbox.vue'),
  }, {
    path: '/profile',
    name: '资料',
    meta: { icon: 'user-circle', authorize: true, hidden: true },
    component: () => import('./views/profile.vue'),
  }, {
    path: '/login',
    name: '登录',
    meta: { icon: 'sign-in-alt', frameless: true, hidden: true },
    component: () => import('./views/login.vue'),
  }],
})

app.component('k-card', Card)

app.component('k-collapse', Collapse)
app.component('k-button', Button)
app.component('k-input', Input)
app.component('k-chart', defineAsyncComponent(() => import('./components/echarts')))

app.provide('ecTheme', 'dark-blue')

app.use(router)

receive('expire', () => {
  router.push('/login')
})

router.beforeEach((route) => {
  if (route.meta.authorize && !user.value) {
    return '/login'
  }
})

router.afterEach((route) => {
  if (typeof route.name === 'string') {
    document.title = route.name + ' | Koishi 控制台'
  }
})

start()

app.mount('#app')
