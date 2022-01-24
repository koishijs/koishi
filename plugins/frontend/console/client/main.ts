/* eslint-disable no-undef */

import { createApp } from 'vue'
import { connect, router, config } from './client'

import form from './components/form'

import Badge from './components/notice/badge.vue'
import Comment from './components/notice/comment.vue'
import Hint from './components/notice/hint.vue'
import Content from './components/layout/content.vue'
import CardAside from './components/layout/card-aside.vue'
import Card from './components/layout/card.vue'
import Collapse from './components/collapse.vue'
import Markdown from './components/markdown.vue'
import Numeric from './components/numeric.vue'
import View from './components/view'
import App from './layout/index.vue'
import Blank from './layout/blank.vue'

import { ElCascader, ElEmpty, ElTooltip, ElScrollbar, ElSelect, ElTree } from 'element-plus'

import '@fortawesome/fontawesome-free/css/fontawesome.css'
import '@fortawesome/fontawesome-free/css/brands.css'
import '@fortawesome/fontawesome-free/css/regular.css'
import '@fortawesome/fontawesome-free/css/solid.css'

import 'element-plus/dist/index.css'
import './index.scss'

const app = createApp(App)

app.use(ElCascader)
app.use(ElEmpty)
app.use(ElTooltip)
app.use(ElSelect)
app.use(ElScrollbar)
app.use(ElTree)

// notice
app.component('k-badge', Badge)
app.component('k-comment', Comment)
app.component('k-hint', Hint)

app.use(form)

app.component('k-content', Content)
app.component('k-card-aside', CardAside)
app.component('k-card', Card)
app.component('k-collapse', Collapse)
app.component('k-markdown', Markdown)
app.component('k-numeric', Numeric)
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
