/* eslint-disable no-undef */

import { createApp } from 'vue'
import { connect, router, config } from './client'
import Collapse from './components/collapse.vue'
import View from './components/view'
import App from './layout/index.vue'
import Blank from './layout/blank.vue'
import client from '~/components'

import {
  ElCascader,
  ElEmpty,
  ElTooltip,
  ElScrollbar,
  ElSelect,
  ElTree,
  ElTable,
  ElTableColumn,
  ElPagination,
  ElLoading,
  ElButton,
  ElPopconfirm,
} from 'element-plus'

import 'element-plus/dist/index.css'
import './index.scss'

const app = createApp(App)

app.use(ElCascader)
app.use(ElEmpty)
app.use(ElTooltip)
app.use(ElSelect)
app.use(ElScrollbar)
app.use(ElTree)
app.use(ElTable)
app.use(ElTableColumn)
app.use(ElPagination)
app.use(ElButton)
app.use(ElLoading)
app.use(ElPopconfirm)
app.use(client)

app.component('k-collapse', Collapse)
app.component('k-view', View)

app.provide('ecTheme', 'dark-blue')

router.addRoute({
  path: '/blank',
  component: Blank,
  meta: { fields: [], position: 'hidden' },
})

app.use(router)

router.afterEach((route) => {
  if (typeof route.name === 'string') {
    document.title = `${route.name} | Koishi 控制台`
  }
})

const endpoint = new URL(config.endpoint, location.origin).toString()

connect(endpoint.replace(/^http/, 'ws'))

app.mount('#app')
