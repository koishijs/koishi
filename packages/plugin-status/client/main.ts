import { createApp } from 'vue'
import { ElButton, ElCollapseTransition } from 'element-plus'
import { THEME_KEY } from 'vue-echarts'
import { createRouter, createWebHistory } from 'vue-router'
import Card from './components/card.vue'
import Button from './components/button.vue'
import Input from './components/input.vue'
import App from './views/layout/index.vue'
import { start, user } from '.'

// for el-collapse-transition
import 'element-plus/lib/theme-chalk/base.css'
import 'element-plus/lib/theme-chalk/el-icon.css'
import 'element-plus/lib/theme-chalk/el-button.css'

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
app.component('k-button', Button)
app.component('k-input', Input)

app.provide(THEME_KEY, 'dark-blue')

app.use(ElButton)
app.use(ElCollapseTransition)

app.use(router)

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
