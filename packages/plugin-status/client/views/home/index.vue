<template>
  <div class="basic-stats">
    <k-card-numeric title="当前消息频率" icon="paper-plane">{{ upRate }} / min</k-card-numeric>
    <k-card-numeric title="近期消息频率" icon="history">{{ recentRate }} / d</k-card-numeric>
    <k-card-numeric title="命名插件数量" icon="plug">{{ status.pluginCount }}</k-card-numeric>
    <k-card-numeric title="数据库体积" icon="database">456 MB</k-card-numeric>
    <k-card-numeric title="活跃用户数量" icon="heart">456</k-card-numeric>
    <k-card-numeric title="活跃群数量" icon="users">32</k-card-numeric>
  </div>
  <load-chart :status="status"/>
  <history-chart :status="status"/>
  <hour-chart :status="status"/>
  <group-chart :status="status"/>
  <word-cloud :status="status"/>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { status } from '~/client'
import GroupChart from './group-chart.vue'
import HistoryChart from './history-chart.vue'
import HourChart from './hour-chart.vue'
import LoadChart from './load-chart.vue'
import WordCloud from './word-cloud.vue'

const upRate = computed(() => {
  return status.value.bots.reduce((sum, bot) => sum + bot.currentRate[0], 0)
})

const recentRate = computed(() => {
  return status.value.bots.reduce((sum, bot) => sum + bot.recentRate[0], 0)
})

</script>

<style lang="scss">

.basic-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  grid-gap: 2rem;
  margin-bottom: 2rem;
}

</style>
