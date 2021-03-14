import { createApp } from 'vue'
import { ElCard, ElButton, ElCollapseTransition } from 'element-plus'
import { THEME_KEY } from 'vue-echarts'
import { createRouter, createWebHistory } from 'vue-router'
import Card from './components/card.vue'
import Layout from './components/layout/index.vue'
import Home from './views/home.vue'

// for el-collapse-transition
import 'element-plus/lib/theme-chalk/base.css'
import 'element-plus/lib/theme-chalk/el-icon.css'
import 'element-plus/lib/theme-chalk/el-card.css'
import 'element-plus/lib/theme-chalk/el-button.css'

import './index.scss'

const app = createApp(Home)

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/plugin', component: () => import('./views/plugin/index.vue') },
  ],
})

app.component('k-layout', Layout)
app.component('k-card', Card)

app.provide(THEME_KEY, 'light')

app.use(ElCard)
app.use(ElButton)
app.use(ElCollapseTransition)

app.use(router)

app.mount('#app')
