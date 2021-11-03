<template>
  <k-card class="frameless" title="历史发言数量">
    <k-chart v-if="Object.keys(history).length" :option="option" autoresize/>
    <p v-else>暂无数据。</p>
  </k-card>
</template>

<script lang="ts" setup>

import { store } from '~/client'
import { computed } from 'vue'

const history = computed(() => store.value.stats.history)

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
    data: Object.keys(history.value).reverse(),
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
    data: Object.values(history.value).reverse(),
  },
}))

</script>
