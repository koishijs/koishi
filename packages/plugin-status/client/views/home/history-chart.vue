<template>
  <k-card class="frameless" title="历史发言数量">
    <v-chart v-if="Object.keys(stats.history).length" :option="option" autoresize/>
    <p v-else>暂无数据。</p>
  </k-card>
</template>

<script lang="ts" setup>

import { stats } from '~/client'
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { LineChart } from 'echarts/charts'
import VChart from 'vue-echarts'

use([CanvasRenderer, GridComponent, TooltipComponent, LineChart])

const week = '日一二三四五六'

const option = computed(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'cross',
    },
    formatter ([{ name, value }]) {
      const day = new Date(name).getDay()
      return `${name} 星期${week[day]}<br>发言数量：${value}`
    },
  },
  xAxis: {
    type: 'category',
    data: Object.keys(stats.value.history).reverse(),
  },
  yAxis: {
    type: 'value',
    axisLabel: {
      formatter: value => value / 1000 + 'k',
    },
  },
  series: {
    type: 'line',
    smooth: true,
    data: Object.values(stats.value.history).reverse(),
  },
}))

</script>
