<template>
  <div class="card-grid profile-grid">
    <k-numeric title="当前消息频率" icon="paper-plane">{{ currentRate }} / min</k-numeric>
    <k-numeric title="近期消息频率" icon="history">{{ recentRate }} / d</k-numeric>
    <k-numeric title="命名插件数量" icon="plug">{{ registry.pluginCount }}</k-numeric>
    <k-numeric title="数据库体积" icon="database">{{ (meta.storageSize / 1048576).toFixed(1) }} MB</k-numeric>
    <k-numeric title="活跃用户数量" icon="heart">{{ meta.activeUsers }}</k-numeric>
    <k-numeric title="活跃群数量" icon="users">{{ meta.activeGroups }}</k-numeric>
  </div>
  <load-chart/>
  <div class="card-grid chart-grid">
    <history-chart/>
    <hour-chart/>
    <group-chart/>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { stats, profile, meta, registry } from '~/client'
import GroupChart from './group-chart.vue'
import HistoryChart from './history-chart.vue'
import HourChart from './hour-chart.vue'
import LoadChart from './load-chart.vue'

const currentRate = computed(() => {
  return profile.value.bots.reduce((sum, bot) => sum + bot.currentRate[0], 0)
})

const recentRate = computed(() => {
  return Object.values(stats.value.botSend).reduce((sum, value) => sum + value, 0).toFixed(1)
})

</script>

<style lang="scss">

</style>
