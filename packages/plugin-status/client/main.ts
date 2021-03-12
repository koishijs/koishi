import { createApp } from 'vue'
import { ElCard, ElCollapseTransition } from 'element-plus'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { BarChart } from 'echarts/charts'
import VChart, { THEME_KEY } from 'vue-echarts'
import Layout from '~/layout'

// for el-collapse-transition
import 'element-plus/lib/theme-chalk/base.css'
import 'element-plus/lib/theme-chalk/el-icon.css'
import 'element-plus/lib/theme-chalk/el-card.css'

import './index.scss'

use(CanvasRenderer)
use(BarChart)
use(GridComponent)
use(TooltipComponent)

const app = createApp(Layout)

app.provide(THEME_KEY, 'light')

app.use(ElCard)
app.use(ElCollapseTransition)

app.component('v-chart', VChart)

app.mount('#app')
