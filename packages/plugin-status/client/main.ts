import { createApp } from 'vue'
import { ElCard, ElCollapseTransition } from 'element-plus'
import App from './app.vue'

// for el-collapse-transition
import 'element-plus/lib/theme-chalk/base.css'
import 'element-plus/lib/theme-chalk/el-icon.css'
import 'element-plus/lib/theme-chalk/el-card.css'

import './index.scss'

const app = createApp(App)

app.use(ElCard)
app.use(ElCollapseTransition)

app.mount('#app')
