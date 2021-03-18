<template>
  <div class="stats-grid basic-stats">
    <card-numeric title="当前消息频率" icon="paper-plane">{{ currentRate }} / min</card-numeric>
    <card-numeric title="近期消息频率" icon="history">{{ recentRate }} / d</card-numeric>
    <card-numeric title="命名插件数量" icon="plug">{{ registry.pluginCount }}</card-numeric>
    <card-numeric title="数据库体积" icon="database">456 MB</card-numeric>
    <card-numeric title="活跃用户数量" icon="heart">456</card-numeric>
    <card-numeric title="活跃群数量" icon="users">32</card-numeric>
  </div>
  <load-chart/>
  <div class="stats-grid chart-stats">
    <history-chart/>
    <hour-chart/>
    <group-chart/>
    <word-cloud/>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { stats, profile, registry } from '~/client'
import CardNumeric from './card-numeric.vue'
import GroupChart from './group-chart.vue'
import HistoryChart from './history-chart.vue'
import HourChart from './hour-chart.vue'
import LoadChart from './load-chart.vue'
import WordCloud from './word-cloud.vue'

const currentRate = computed(() => {
  return profile.value.bots.reduce((sum, bot) => sum + bot.currentRate[0], 0)
})

const recentRate = computed(() => {
  return Object.values(stats.value.botSend).reduce((sum, value) => sum + value, 0).toFixed(1)
})

</script>

<style lang="scss">

.stats-grid .k-card {
  margin: 0;
}

.basic-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  grid-gap: 2rem;
  margin-bottom: 2rem;
}

.chart-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  grid-gap: 2rem;
  margin: 2rem 0 4rem;

  .echarts {
    width: 600px;
    height: 400px;
    max-width: 100%;
    margin: 0 auto -3rem;
  }

  @media screen and (max-width: 1440px) {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, 1fr);

    .echarts {
      width: 800px;
      height: 400px;
    }
  }
}

</style>
